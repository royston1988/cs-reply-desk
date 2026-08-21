import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The Cases board: returns, exchanges and complaints in one queue.
 *
 * Cases are DERIVED from the conversations already in cs_fb_inbox — nothing is
 * copied or duplicated. Only the handling state (who owns it, is it done, any
 * note) is stored, and that goes in its own table `cs_cases`.
 *
 * It deliberately does NOT write into cs_fb_inbox. The AC OS dashboard reads
 * that table and maps every row to a conversation, so a row that isn't one
 * would show up there as a broken chat.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

/** Six hours is the target the previous CS system used. Kept for continuity. */
export const SLA_HOURS = 6;

type Msg = { from?: string; at?: number; text?: string };

export type CaseStatus = "open" | "waiting_customer" | "done";

export type CaseRow = {
  id: string;
  name: string;
  kind: "Complaint" | "Exchange" | "Payment";
  lastMessage: string;
  lastFrom: "customer" | "cs";
  /** How long the customer has been waiting, in minutes. 0 if we replied last. */
  waitingMins: number;
  overdue: boolean;
  neverAnswered: boolean;
  status: CaseStatus;
  owner: string;
  note: string;
};

export type CasesResult = {
  ok: boolean;
  error?: string;
  /** True when cs_cases does not exist yet — the board is read-only. */
  stateTableMissing: boolean;
  cases: CaseRow[];
  counts: { open: number; overdue: number; done: number };
};

const KIND: Record<string, CaseRow["kind"]> = {
  complaint: "Complaint",
  exchange: "Exchange",
  payment: "Payment",
};

function client(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export async function fetchCases(limit = 1000): Promise<CasesResult> {
  const empty = { open: 0, overdue: 0, done: 0 };
  const supabase = client();
  if (!supabase) {
    return { ok: false, error: "Supabase key missing.", stateTableMissing: true, cases: [], counts: empty };
  }

  const { data, error } = await supabase
    .from("cs_fb_inbox")
    .select("id, updated_at, data")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, error: error.message, stateTableMissing: true, cases: [], counts: empty };
  }

  // Handling state lives in its own table. If it isn't there yet, carry on read-only.
  let states: Record<string, { status?: CaseStatus; owner?: string; note?: string }> = {};
  let stateTableMissing = false;
  const st = await supabase.from("cs_cases").select("conv_id, status, owner, note");
  if (st.error) {
    stateTableMissing = true;
  } else {
    states = Object.fromEntries(
      (st.data ?? []).map((r) => [
        (r as { conv_id: string }).conv_id,
        r as { status?: CaseStatus; owner?: string; note?: string },
      ]),
    );
  }

  const cases: CaseRow[] = [];

  for (const row of data ?? []) {
    const d = (row as { data: { messages?: Msg[]; intent?: string; name?: string } }).data;
    const kind = KIND[d?.intent ?? ""];
    if (!kind || !d?.name) continue;

    const messages = Array.isArray(d.messages) ? d.messages : [];
    if (!messages.length) continue;

    const last = messages[messages.length - 1];
    const lastFrom: "customer" | "cs" = last?.from === "cs" ? "cs" : "customer";

    const firstCust = messages.find((m) => m.from === "customer" && typeof m.at === "number");
    const anyReply = messages.some(
      (m) => m.from === "cs" && typeof m.at === "number" && m.at! > (firstCust?.at ?? 0),
    );

    const waitingMins =
      lastFrom === "customer" && typeof last.at === "number"
        ? Math.max(0, Math.round((Date.now() - last.at) / 60000))
        : 0;

    const saved = states[String(row.id)] ?? {};
    const status: CaseStatus =
      saved.status ?? (lastFrom === "customer" ? "open" : "waiting_customer");

    cases.push({
      id: String(row.id),
      name: d.name,
      kind,
      lastMessage: (last?.text ?? "").trim() || "[photo or attachment]",
      lastFrom,
      waitingMins,
      overdue: status !== "done" && waitingMins > SLA_HOURS * 60,
      neverAnswered: !anyReply,
      status,
      owner: saved.owner ?? "",
      note: saved.note ?? "",
    });
  }

  // Longest-waiting first: the person most likely to be writing a bad review.
  cases.sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (b.status === "done" && a.status !== "done") return -1;
    return b.waitingMins - a.waitingMins;
  });

  return {
    ok: true,
    stateTableMissing,
    cases,
    counts: {
      open: cases.filter((c) => c.status === "open").length,
      overdue: cases.filter((c) => c.overdue).length,
      done: cases.filter((c) => c.status === "done").length,
    },
  };
}

/**
 * Facts about one case, read from the conversation itself.
 *
 * Points are decided from THIS, never from what the browser claims. Otherwise
 * anyone could close an untouched case and claim the reward for helping.
 */
export async function getCaseFacts(
  convId: string,
): Promise<{ kind: CaseRow["kind"] | null; answered: boolean; waitedMins: number }> {
  const supabase = client();
  if (!supabase) return { kind: null, answered: false, waitedMins: 0 };

  const { data, error } = await supabase
    .from("cs_fb_inbox")
    .select("data")
    .eq("id", convId)
    .maybeSingle();
  if (error || !data) return { kind: null, answered: false, waitedMins: 0 };

  const d = (data as { data: { messages?: Msg[]; intent?: string } }).data;
  const messages = Array.isArray(d?.messages) ? d.messages : [];
  const firstCust = messages.find((m) => m.from === "customer" && typeof m.at === "number");
  const reply = messages.find(
    (m) => m.from === "cs" && typeof m.at === "number" && m.at! > (firstCust?.at ?? 0),
  );

  const waitedMins =
    firstCust?.at && reply?.at ? Math.round((reply.at - firstCust.at) / 60000) : 0;

  return {
    kind: KIND[d?.intent ?? ""] ?? null,
    answered: Boolean(reply),
    waitedMins,
  };
}

export async function saveCase(
  convId: string,
  patch: { status?: CaseStatus; owner?: string; note?: string },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = client();
  if (!supabase) return { ok: false, error: "Supabase key missing." };

  const { error } = await supabase
    .from("cs_cases")
    .upsert(
      [{ conv_id: convId, ...patch, updated_at: new Date().toISOString() }],
      { onConflict: "conv_id" },
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
