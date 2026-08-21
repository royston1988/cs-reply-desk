import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { listRules, myStats, teamTotals } from "@/lib/points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** My own points dashboard. Everyone can see the team totals — no secrets there. */
export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  if (!gate.staff) {
    return NextResponse.json(
      { ok: false, error: "Signed in with the shared PIN, so there is no personal scorecard yet." },
      { status: 400 },
    );
  }

  const [stats, rules, team] = await Promise.all([
    myStats(gate.staff.id),
    listRules(),
    teamTotals(),
  ]);

  return NextResponse.json(
    { ok: true, staff: gate.staff, stats, rules, team },
    { headers: { "Cache-Control": "no-store" } },
  );
}
