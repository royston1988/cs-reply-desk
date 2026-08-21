import { db } from "./staff";

/**
 * The points ledger.
 *
 * Two rules shape this on purpose:
 *
 *  1. Points reward work we can verify, not clicks. Closing a case only scores
 *     if the customer actually received a reply — otherwise the quickest way to
 *     earn would be to close everything without helping anyone.
 *
 *  2. The biggest award goes to rescuing someone who has been waiting hours,
 *     because that is the failure that actually costs the business. Paying most
 *     for the easy fast replies would reward cherry-picking.
 */

export type Rule = { action: string; label: string; points: number; active: boolean };

export type LedgerEntry = {
  id: number;
  staff_id: string;
  action: string;
  points: number;
  ref: string;
  note: string;
  created_at: string;
};

export type MyStats = {
  today: number;
  week: number;
  month: number;
  allTime: number;
  byAction: { action: string; label: string; count: number; points: number }[];
  recent: LedgerEntry[];
};

export async function listRules(): Promise<Rule[]> {
  const supabase = db();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("cs_point_rules")
    .select("action, label, points, active")
    .order("points", { ascending: false });
  if (error) return [];
  return (data ?? []) as Rule[];
}

export async function updateRule(
  action: string,
  patch: { points?: number; label?: string; active?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db();
  if (!supabase) return { ok: false, error: "No database." };
  const { error } = await supabase
    .from("cs_point_rules")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("action", action);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Award points for one action. The unique index on (staff_id, action, ref)
 * means the same piece of work can never be claimed twice — a repeat is
 * silently ignored rather than treated as an error.
 */
export async function award(
  staffId: string,
  action: string,
  ref: string,
  note = "",
): Promise<{ ok: boolean; points?: number; duplicate?: boolean; error?: string }> {
  const supabase = db();
  if (!supabase) return { ok: false, error: "No database." };

  const { data: rule } = await supabase
    .from("cs_point_rules")
    .select("points, active")
    .eq("action", action)
    .maybeSingle();

  const r = rule as { points: number; active: boolean } | null;
  if (!r || !r.active) return { ok: true, points: 0 };

  const { error } = await supabase
    .from("cs_points")
    .insert([{ staff_id: staffId, action, points: r.points, ref, note }]);

  if (error) {
    // 23505 = the "already claimed this one" unique index. Not a failure.
    if (error.code === "23505") return { ok: true, points: 0, duplicate: true };
    return { ok: false, error: error.message };
  }
  return { ok: true, points: r.points };
}

function since(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export async function myStats(staffId: string): Promise<MyStats> {
  const empty: MyStats = { today: 0, week: 0, month: 0, allTime: 0, byAction: [], recent: [] };
  const supabase = db();
  if (!supabase) return empty;

  const { data, error } = await supabase
    .from("cs_points")
    .select("id, staff_id, action, points, ref, note, created_at")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return empty;

  const rows = (data ?? []) as LedgerEntry[];
  const rules = await listRules();
  const labels = Object.fromEntries(rules.map((r) => [r.action, r.label]));

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayISO = startOfToday.toISOString();

  const sum = (f: (r: LedgerEntry) => boolean) =>
    rows.filter(f).reduce((n, r) => n + r.points, 0);

  const grouped = new Map<string, { count: number; points: number }>();
  rows.forEach((r) => {
    const g = grouped.get(r.action) ?? { count: 0, points: 0 };
    g.count++;
    g.points += r.points;
    grouped.set(r.action, g);
  });

  return {
    today: sum((r) => r.created_at >= todayISO),
    week: sum((r) => r.created_at >= since(7)),
    month: sum((r) => r.created_at >= since(30)),
    allTime: sum(() => true),
    byAction: [...grouped.entries()]
      .map(([action, g]) => ({ action, label: labels[action] ?? action, ...g }))
      .sort((a, b) => b.points - a.points),
    recent: rows.slice(0, 25),
  };
}

export type TeamRow = { staffId: string; name: string; today: number; week: number; month: number; allTime: number };

export async function teamTotals(): Promise<TeamRow[]> {
  const supabase = db();
  if (!supabase) return [];

  const [{ data: staff }, { data: pts }] = await Promise.all([
    supabase.from("cs_staff").select("id, name").eq("active", true),
    supabase.from("cs_points").select("staff_id, points, created_at").limit(20000),
  ]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayISO = startOfToday.toISOString();
  const rows = (pts ?? []) as { staff_id: string; points: number; created_at: string }[];

  return ((staff ?? []) as { id: string; name: string }[])
    .map((s) => {
      const mine = rows.filter((r) => r.staff_id === s.id);
      const sum = (f: (r: (typeof rows)[number]) => boolean) =>
        mine.filter(f).reduce((n, r) => n + r.points, 0);
      return {
        staffId: s.id,
        name: s.name,
        today: sum((r) => r.created_at >= todayISO),
        week: sum((r) => r.created_at >= since(7)),
        month: sum((r) => r.created_at >= since(30)),
        allTime: sum(() => true),
      };
    })
    .sort((a, b) => b.month - a.month);
}

/** Admin correction — can be negative. Always leaves a trace in the ledger. */
export async function adjust(
  staffId: string,
  points: number,
  note: string,
  byWhom: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = db();
  if (!supabase) return { ok: false, error: "No database." };
  const { error } = await supabase.from("cs_points").insert([
    {
      staff_id: staffId,
      action: "manual_adjustment",
      points,
      ref: `adj-${Date.now()}`,
      note: `${note} (by ${byWhom})`,
    },
  ]);
  return error ? { ok: false, error: error.message } : { ok: true };
}
