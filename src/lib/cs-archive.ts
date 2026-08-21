import { createClient } from "@supabase/supabase-js";
import type { Conversation, Message, Suggestion } from "./mock-data";

/**
 * Reads the real Facebook conversations that already live in Supabase
 * (public.cs_fb_inbox — 57,653 of them, collected up to 14 Aug 2026).
 *
 * SERVER SIDE ONLY. These are real customers, so the key never goes near
 * the browser: this file is imported by the API route, never by a page.
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? "https://qiyfuxiccphxlnrhsmvf.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

/** Row shape stored by the old CS system. */
type ArchivedMessage = {
  from?: "customer" | "cs";
  text?: string;
  at?: number;
};
type ArchivedConversation = {
  id?: string;
  name?: string;
  intent?: string;
  messages?: ArchivedMessage[];
  suggestedReply?: string;
  assignedCs?: string;
};

const INTENT_LABEL: Record<string, string> = {
  shipping: "Where is my order",
  payment: "Payment",
  stock: "Stock / size",
  sizing: "Sizing",
  exchange: "Exchange",
  complaint: "Complaint",
  product: "Product question",
  order: "Order",
  general: "General",
};

/**
 * Roughly half this inbox is people tapping automated menu buttons, not asking
 * anything — "Continue ➡️", "Get started", "English", and so on. Showing those
 * to CS is most of why the queue looks impossible. Anything that is only a
 * button tap gets filtered out before it reaches the screen.
 */
const BOT_BUTTONS = [
  "continue", "get started", "get updates", "get offers", "notify me",
  "enable", "my shopping cart", "warm reminder", "english", "华语",
  "中文 / chinese", "中文", "开始", "接收动态更新", "pm", "ok", "hi", "hello",
  "can i make a purchase?", "can i see more products?",
  "can you check the price of a product?", "is this available in my size?",
  "what are your delivery options?", "i'm interested. can you tell me more?",
  "how much does this cost?", "how to order?",
];

const strip = (s: string) =>
  s.toLowerCase().replace(/[➡️🛒✨💚🙏\s]+/g, " ").trim();

function isRealQuestion(messages: ArchivedMessage[]): boolean {
  return messages.some((m) => {
    if (m.from !== "customer") return false;
    const t = (m.text ?? "").trim();
    if (!t || t === "[attachment]") return false;
    if (t.length <= 4) return false;
    return !BOT_BUTTONS.includes(strip(t));
  });
}

function timeLabel(at?: number): string {
  if (!at) return "";
  const d = new Date(at);
  const now = new Date();
  const hhmm = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return hhmm;
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${hhmm}`;
}

export type ArchiveResult = {
  connected: boolean;
  error?: string;
  conversations: Conversation[];
  /** How many were hidden as button-taps — worth showing, it's the headline. */
  noiseFiltered?: number;
};

export async function fetchArchive(limit = 200): Promise<ArchiveResult> {
  if (!SERVICE_KEY) {
    return {
      connected: false,
      error: "No Supabase key yet — showing sample messages.",
      conversations: [],
    };
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("cs_fb_inbox")
    .select("id, updated_at, data")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { connected: false, error: error.message, conversations: [] };
  }

  let noiseFiltered = 0;
  const conversations: Conversation[] = [];

  for (const row of data ?? []) {
    const d = (row as { data: ArchivedConversation }).data;
    const raw = Array.isArray(d?.messages) ? d.messages : [];
    if (!raw.length) continue;

    // Skip the sync bookkeeping row and anything that is only button taps.
    if (!d?.name) continue;
    if (!isRealQuestion(raw)) {
      noiseFiltered++;
      continue;
    }

    const messages: Message[] = raw.map((m, i) => ({
      id: `${row.id}-${i}`,
      from: m.from === "cs" ? "ac" : "customer",
      text: (m.text ?? "").trim() || "[photo or attachment]",
      time: timeLabel(m.at),
      agent: m.from === "cs" ? d.assignedCs : undefined,
    }));

    const last = raw[raw.length - 1];
    const lastIsCustomer = last?.from !== "cs";

    // The old system already drafted a reply for some of these — show it,
    // clearly labelled, rather than pretending we wrote it.
    const suggestions: Suggestion[] = d.suggestedReply
      ? [
          {
            id: `${row.id}-s`,
            lang: "mix",
            text: d.suggestedReply,
            source: "Draft from your existing CS system",
          },
        ]
      : [];

    conversations.push({
      id: String(row.id),
      name: d.name,
      channel: "messenger",
      topic: INTENT_LABEL[d.intent ?? "general"] ?? "General",
      waitingMins: lastIsCustomer && last?.at
        ? Math.max(0, Math.round((Date.now() - last.at) / 60000))
        : 0,
      status: lastIsCustomer ? "need_reply" : "waiting",
      messages,
      suggestions,
      // Complaints involve money and upset customers — never pre-write those.
      writeItYourself: d.intent === "complaint",
      riskNote:
        d.intent === "complaint"
          ? "Complaint — please answer in your own words."
          : undefined,
    });
  }

  return { connected: true, conversations, noiseFiltered };
}
