import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { fetchCases, getCaseFacts, saveCase, SLA_HOURS, type CaseStatus } from "@/lib/cases";
import { award } from "@/lib/points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const result = await fetchCases();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  let body: { convId?: string; status?: CaseStatus; owner?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  if (!body.convId) return NextResponse.json({ ok: false, error: "Missing case id" }, { status: 400 });

  const saved = await saveCase(body.convId, {
    status: body.status,
    owner: body.owner,
    note: body.note,
  });
  if (!saved.ok) return NextResponse.json(saved, { status: 400 });

  // ---- points ----
  // Only for a real signed-in person, only on closing, and only when the facts
  // in the conversation back it up. Closing an untouched case earns nothing.
  let earned = 0;
  const notes: string[] = [];

  if (gate.staff && body.status === "done") {
    const facts = await getCaseFacts(body.convId);

    if (!facts.answered) {
      notes.push("No points — this customer never actually got a reply.");
    } else {
      const closeAction = facts.kind === "Complaint" ? "complaint_closed" : "case_closed";
      const a = await award(gate.staff.id, closeAction, body.convId, facts.kind ?? "");
      earned += a.points ?? 0;

      // Extra for digging someone out of the backlog rather than cherry-picking
      // the quick ones.
      if (facts.waitedMins > SLA_HOURS * 60) {
        const r = await award(gate.staff.id, "rescue", body.convId, `waited ${Math.round(facts.waitedMins / 60)}h`);
        earned += r.points ?? 0;
      } else if (facts.waitedMins > 0 && facts.waitedMins <= 15) {
        const f = await award(gate.staff.id, "fast_reply", body.convId, "");
        earned += f.points ?? 0;
      }
    }
  }

  return NextResponse.json({ ...saved, earned, notes });
}
