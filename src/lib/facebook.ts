import type { Conversation, Message } from "./mock-data";

const GRAPH = "https://graph.facebook.com/v21.0";

/** AC - Ample Couture. Override in .env.local if the page ever changes. */
export const PAGE_ID = process.env.FB_PAGE_ID ?? "303915139678621";

type GraphParticipant = { id: string; name?: string };
type GraphMessage = {
  id: string;
  message?: string;
  created_time: string;
  from?: { id: string; name?: string };
};
type GraphConversation = {
  id: string;
  updated_time: string;
  participants?: { data: GraphParticipant[] };
  messages?: { data: GraphMessage[] };
};

/**
 * Rough guess at what the customer is asking about, from keywords only.
 * Good enough to sort the list; the AI does the real classifying later.
 */
function guessTopic(text: string): string {
  const t = text.toLowerCase();
  if (/(refund|退款|damage|broken|坏|洞|complain|投诉|disappoint|失望)/.test(t))
    return "Complaint";
  if (/(exchange|return|换|退货|too big|too small|size wrong)/.test(t)) return "Exchange";
  if (/(paid|payment|transfer|转账|付款|receipt|slip)/.test(t)) return "Payment";
  if (/(stock|size|available|有货|还有|尺码|m码|l码|s码)/.test(t)) return "Stock / size";
  if (/(where|parcel|tracking|delivery|still not|没收到|寄出|快递|几时到)/.test(t))
    return "Where is my order";
  return "General";
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hhmm = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return hhmm;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return `Yesterday ${hhmm}`;
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${hhmm}`;
}

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

export type FetchResult = {
  connected: boolean;
  error?: string;
  conversations: Conversation[];
};

export async function fetchConversations(limit = 25): Promise<FetchResult> {
  const token = process.env.FB_PAGE_TOKEN;
  if (!token) {
    return {
      connected: false,
      error: "No Facebook token yet — showing sample messages.",
      conversations: [],
    };
  }

  const fields = [
    "id",
    "updated_time",
    "participants",
    "messages.limit(20){id,message,created_time,from}",
  ].join(",");

  const url =
    `${GRAPH}/${PAGE_ID}/conversations` +
    `?platform=messenger&fields=${encodeURIComponent(fields)}&limit=${limit}` +
    `&access_token=${encodeURIComponent(token)}`;

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    return {
      connected: false,
      error: "Could not reach Facebook. Check the internet connection.",
      conversations: [],
    };
  }

  const body = await res.json().catch(() => null);

  if (!res.ok || body?.error) {
    // Never echo the token back out, only Facebook's own message.
    return {
      connected: false,
      error: body?.error?.message ?? `Facebook returned ${res.status}.`,
      conversations: [],
    };
  }

  const raw: GraphConversation[] = body?.data ?? [];

  const conversations: Conversation[] = raw.map((c) => {
    const customer =
      c.participants?.data.find((p) => p.id !== PAGE_ID) ?? c.participants?.data[0];

    // Graph returns newest first — flip so the thread reads top to bottom.
    const ordered = [...(c.messages?.data ?? [])].reverse();

    const messages: Message[] = ordered.map((m) => ({
      id: m.id,
      from: m.from?.id === PAGE_ID ? "ac" : "customer",
      text: m.message?.trim() || "[photo or attachment]",
      time: timeLabel(m.created_time),
      agent: m.from?.id === PAGE_ID ? m.from?.name : undefined,
    }));

    const lastRaw = ordered[ordered.length - 1];
    const lastIsCustomer = lastRaw?.from?.id !== PAGE_ID;

    const customerText = ordered
      .filter((m) => m.from?.id !== PAGE_ID)
      .map((m) => m.message ?? "")
      .join(" ");

    return {
      id: c.id,
      name: customer?.name ?? "Unknown customer",
      channel: "messenger",
      topic: guessTopic(customerText),
      waitingMins: lastIsCustomer && lastRaw ? minutesSince(lastRaw.created_time) : 0,
      status: lastIsCustomer ? "need_reply" : "waiting",
      messages,
      // AI suggestions and order lookup are the next two steps.
      suggestions: [],
    };
  });

  // Longest wait first — the person most likely to be angry.
  conversations.sort((a, b) => b.waitingMins - a.waitingMins);

  return { connected: true, conversations };
}
