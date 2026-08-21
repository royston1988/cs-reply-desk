import { createClient } from "@supabase/supabase-js";

/**
 * Reply-speed scoreboard, computed from real message timestamps.
 *
 * What it deliberately does NOT do: rank people. The stored `assignedCs` field
 * looks like it names who handled a chat, but it is really a rule — all shipping
 * goes to "Chin Pui", all stock to "Evelyn", all complaints to "Yan". Scoring
 * staff on that would be scoring a lookup table. Per-person numbers become real
 * once replies are sent from this app.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

type Msg = { from?: string; at?: number; text?: string };

const BOT_BUTTONS = [
  "continue", "get started", "get updates", "get offers", "notify me",
  "enable", "my shopping cart", "warm reminder", "english", "华语",
  "中文 / chinese", "中文", "开始", "接收动态更新", "pm", "ok", "hi", "hello",
  "can i make a purchase?", "can i see more products?",
  "can you check the price of a product?", "is this available in my size?",
  "what are your delivery options?", "i'm interested. can you tell me more?",
  "how much does this cost?", "how to order?",
];
const strip = (s: string) => s.toLowerCase().replace(/[➡️🛒✨💚🙏\s]+/g, " ").trim();

/** Did a human actually type something, or is this only button taps? */
function isRealQuestion(messages: Msg[]): boolean {
  return messages.some((m) => {
    if (m.from !== "customer") return false;
    const t = (m.text ?? "").trim();
    if (!t || t === "[attachment]" || t.length <= 4) return false;
    return !BOT_BUTTONS.includes(strip(t));
  });
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export type TopicRow = {
  topic: string;
  conversations: number;
  neverAnswered: number;
  medianMins: number | null;
  pctWithin6h: number;
};

export type Scoreboard = {
  ok: boolean;
  error?: string;
  sampleSize: number;
  newestDate: string | null;
  /** Everything, including bot button-taps — the flattering number. */
  all: { answered: number; medianMins: number | null; pctWithin15m: number; pctWithin1h: number; pctWithin6h: number; neverAnswered: number };
  /** Only conversations where a human actually typed — the honest number. */
  human: { answered: number; medianMins: number | null; pctWithin15m: number; pctWithin1h: number; pctWithin6h: number; neverAnswered: number };
  byTopic: TopicRow[];
};

const TOPIC_LABEL: Record<string, string> = {
  shipping: "Where is my order",
  payment: "Payment",
  stock: "Stock",
  sizing: "Sizing",
  exchange: "Exchange",
  complaint: "Complaint",
  product: "Product question",
  general: "General",
  order: "Order",
};

export async function fetchScoreboard(limit = 4000): Promise<Scoreboard> {
  const empty = { answered: 0, medianMins: null, pctWithin15m: 0, pctWithin1h: 0, pctWithin6h: 0, neverAnswered: 0 };
  if (!SERVICE_KEY || !SUPABASE_URL) {
    return { ok: false, error: "Supabase key missing.", sampleSize: 0, newestDate: null, all: empty, human: empty, byTopic: [] };
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("cs_fb_inbox")
    .select("id, updated_at, data")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, error: error.message, sampleSize: 0, newestDate: null, all: empty, human: empty, byTopic: [] };
  }

  const allMins: number[] = [];
  const humanMins: number[] = [];
  let allNever = 0;
  let humanNever = 0;
  let sampleSize = 0;
  let newest: string | null = null;

  const topics = new Map<string, { n: number; never: number; mins: number[] }>();

  for (const row of data ?? []) {
    const d = (row as { data: { messages?: Msg[]; intent?: string; name?: string } }).data;
    const messages = Array.isArray(d?.messages) ? d.messages : [];
    if (!messages.length || !d?.name) continue; // skip the sync bookkeeping row
    sampleSize++;
    const updated = (row as { updated_at: string }).updated_at;
    if (!newest || updated > newest) newest = updated;

    const firstCust = messages
      .filter((m) => m.from === "customer" && typeof m.at === "number")
      .reduce<number | null>((min, m) => (min === null || m.at! < min ? m.at! : min), null);
    if (firstCust === null) continue;

    const firstReply = messages
      .filter((m) => m.from === "cs" && typeof m.at === "number" && m.at! > firstCust)
      .reduce<number | null>((min, m) => (min === null || m.at! < min ? m.at! : min), null);

    const human = isRealQuestion(messages);
    const topic = TOPIC_LABEL[d.intent ?? "general"] ?? "General";
    if (!topics.has(topic)) topics.set(topic, { n: 0, never: 0, mins: [] });
    const t = topics.get(topic)!;
    t.n++;

    if (firstReply === null) {
      allNever++;
      if (human) humanNever++;
      t.never++;
      continue;
    }

    const mins = (firstReply - firstCust) / 60000;
    if (mins < 0 || mins > 30 * 24 * 60) continue; // ignore nonsense gaps
    allMins.push(mins);
    if (human) humanMins.push(mins);
    t.mins.push(mins);
  }

  const summarise = (mins: number[], never: number) => ({
    answered: mins.length,
    medianMins: median(mins),
    pctWithin15m: mins.length ? +((100 * mins.filter((m) => m <= 15).length) / mins.length).toFixed(1) : 0,
    pctWithin1h: mins.length ? +((100 * mins.filter((m) => m <= 60).length) / mins.length).toFixed(1) : 0,
    pctWithin6h: mins.length ? +((100 * mins.filter((m) => m <= 360).length) / mins.length).toFixed(1) : 0,
    neverAnswered: never,
  });

  const byTopic: TopicRow[] = [...topics.entries()]
    .map(([topic, t]) => ({
      topic,
      conversations: t.n,
      neverAnswered: t.never,
      medianMins: median(t.mins),
      pctWithin6h: t.mins.length ? +((100 * t.mins.filter((m) => m <= 360).length) / t.mins.length).toFixed(1) : 0,
    }))
    // Slowest first — that's where the damage is.
    .sort((a, b) => (b.medianMins ?? 0) - (a.medianMins ?? 0));

  return {
    ok: true,
    sampleSize,
    newestDate: newest,
    all: summarise(allMins, allNever),
    human: summarise(humanMins, humanNever),
    byTopic,
  };
}
