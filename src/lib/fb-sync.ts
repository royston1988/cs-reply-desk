import { createClient } from "@supabase/supabase-js";

/**
 * Pulls Facebook Messenger conversations and stores them in Supabase
 * (public.cs_fb_inbox) — the same table and the same shape the old CS system
 * used, so the AC OS dashboard keeps working off it too.
 *
 * Collection stopped on 14 Aug 2026, almost certainly because the page token
 * expired. This route restarts it.
 *
 * One deliberate improvement: the old collector threw photos away and wrote
 * the word "[attachment]" — 138,087 times. This one keeps the image URL, so a
 * customer sending a photo of a damaged dress is no longer invisible.
 */

const GRAPH = "https://graph.facebook.com/v21.0";
const PAGE_ID = process.env.FB_PAGE_ID ?? "303915139678621";
const PAGE_NAME = "Ample Couture";

type GraphAttachment = {
  image_data?: { url?: string; preview_url?: string };
  file_url?: string;
  mime_type?: string;
};
type GraphMessage = {
  id: string;
  message?: string;
  created_time: string;
  from?: { id?: string; name?: string };
  attachments?: { data?: GraphAttachment[] };
};
type GraphConversation = {
  id: string;
  updated_time?: string;
  unread_count?: number;
  senders?: { data?: { id?: string; name?: string }[] };
  messages?: { data?: GraphMessage[] };
};

/** Same shape the old system wrote, so nothing downstream breaks. */
type StoredMessage = {
  from: "customer" | "cs";
  text: string;
  at: number;
  images?: string[];
};
type StoredConversation = {
  id: string;
  name: string;
  channel: "messenger";
  page: string;
  pageId: string;
  fbUserId: string;
  intent: string;
  messages: StoredMessage[];
  waitingMins: number;
  unread: boolean;
  assignedCs: string;
  suggestedReply: string;
};

/** Same keyword rules the old system used, so tagging stays consistent. */
function detectIntent(text: string): string {
  const t = text.toLowerCase();
  if (/(refund|退款|damage|broken|坏|洞|complain|投诉|disappoint|失望)/.test(t)) return "complaint";
  if (/(exchange|return|换|退货|too big|too small)/.test(t)) return "exchange";
  if (/(paid|payment|transfer|转账|付款|receipt|slip)/.test(t)) return "payment";
  if (/(size|sizing|fit|尺码|身高|体重)/.test(t)) return "sizing";
  if (/(stock|available|有货|还有|restock|补货)/.test(t)) return "stock";
  if (/(where|parcel|tracking|delivery|shipped|没收到|寄出|快递|几时到)/.test(t)) return "shipping";
  return "general";
}

function attachmentUrls(m: GraphMessage): string[] {
  const out: string[] = [];
  for (const a of m.attachments?.data ?? []) {
    const url = a.image_data?.url ?? a.file_url;
    if (url) out.push(url);
  }
  return out;
}

export type SyncResult = {
  ok: boolean;
  error?: string;
  pulled?: number;
  stored?: number;
  pagesFetched?: number;
};

export async function syncFacebookToSupabase(maxPages = 5): Promise<SyncResult> {
  const token = process.env.FB_PAGE_TOKEN;
  if (!token) return { ok: false, error: "No Facebook page key yet." };

  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return { ok: false, error: "Supabase key missing." };
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const fields = [
    "id",
    "updated_time",
    "unread_count",
    "senders",
    "messages.limit(25){id,message,created_time,from,attachments{image_data,file_url,mime_type}}",
  ].join(",");

  let url =
    `${GRAPH}/${PAGE_ID}/conversations` +
    `?platform=messenger&fields=${encodeURIComponent(fields)}&limit=50` +
    `&access_token=${encodeURIComponent(token)}`;

  let pulled = 0;
  let stored = 0;
  let pagesFetched = 0;

  for (let page = 0; page < maxPages && url; page++) {
    let body: {
      data?: GraphConversation[];
      paging?: { next?: string };
      error?: { message?: string };
    };
    try {
      const res = await fetch(url, { cache: "no-store" });
      body = await res.json();
    } catch {
      return { ok: false, error: "Could not reach Facebook.", pulled, stored, pagesFetched };
    }
    if (body?.error) {
      // Surface Facebook's own wording — never the token.
      return { ok: false, error: body.error.message ?? "Facebook refused.", pulled, stored, pagesFetched };
    }

    pagesFetched++;
    const convos = body.data ?? [];
    pulled += convos.length;

    const rows = convos
      .map((c) => {
        const customer =
          c.senders?.data?.find((s) => String(s.id) !== PAGE_ID) ?? c.senders?.data?.[0];
        // Graph returns newest first — flip so the thread reads top to bottom.
        const raw = [...(c.messages?.data ?? [])].reverse();
        if (!raw.length) return null;

        const messages: StoredMessage[] = raw.map((m) => {
          const images = attachmentUrls(m);
          return {
            from: m.from?.id === PAGE_ID ? "cs" : "customer",
            text: (m.message ?? "").trim() || (images.length ? "[photo]" : "[attachment]"),
            at: new Date(m.created_time).getTime(),
            ...(images.length ? { images } : {}),
          };
        });

        const last = messages[messages.length - 1];
        const customerText = messages
          .filter((m) => m.from === "customer")
          .map((m) => m.text)
          .join(" ");

        const conv: StoredConversation = {
          id: c.id,
          name: customer?.name ?? "Unknown customer",
          channel: "messenger",
          page: PAGE_NAME,
          pageId: PAGE_ID,
          fbUserId: customer?.id ? String(customer.id) : "",
          intent: detectIntent(customerText),
          messages,
          waitingMins:
            last.from === "customer"
              ? Math.max(0, Math.round((Date.now() - last.at) / 60000))
              : 0,
          unread: Boolean(c.unread_count),
          assignedCs: "",
          suggestedReply: "",
        };

        return {
          id: c.id,
          updated_at: c.updated_time ?? new Date(last.at).toISOString(),
          data: conv,
        };
      })
      .filter(Boolean) as { id: string; updated_at: string; data: StoredConversation }[];

    if (rows.length) {
      const { error } = await supabase
        .from("cs_fb_inbox")
        .upsert(rows, { onConflict: "id" });
      if (error) return { ok: false, error: error.message, pulled, stored, pagesFetched };
      stored += rows.length;
    }

    url = body.paging?.next ?? "";
  }

  return { ok: true, pulled, stored, pagesFetched };
}
