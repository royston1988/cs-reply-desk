import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { adjust, listRules, teamTotals, updateRule } from "@/lib/points";
import { listStaff, setPin } from "@/lib/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminOnly() {
  const gate = await requireUser();
  if (!gate.ok) return { blocked: gate.response, staff: null };
  if (!gate.staff || gate.staff.role !== "admin") {
    return {
      blocked: NextResponse.json({ ok: false, error: "Admins only" }, { status: 403 }),
      staff: null,
    };
  }
  return { blocked: null, staff: gate.staff };
}

export async function GET() {
  const { blocked } = await adminOnly();
  if (blocked) return blocked;

  const [rules, team, people] = await Promise.all([listRules(), teamTotals(), listStaff()]);
  return NextResponse.json(
    { ok: true, rules, team, people },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const { blocked, staff } = await adminOnly();
  if (blocked) return blocked;

  let body: {
    type?: "rule" | "adjust" | "pin";
    action?: string;
    points?: number;
    label?: string;
    active?: boolean;
    staffId?: string;
    note?: string;
    pin?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }

  if (body.type === "rule" && body.action) {
    const result = await updateRule(body.action, {
      points: body.points,
      label: body.label,
      active: body.active,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (body.type === "adjust" && body.staffId && typeof body.points === "number") {
    const result = await adjust(
      body.staffId,
      body.points,
      body.note ?? "manual adjustment",
      staff!.name,
    );
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (body.type === "pin" && body.staffId && body.pin) {
    if (body.pin.length < 4) {
      return NextResponse.json({ ok: false, error: "PIN must be at least 4 characters" }, { status: 400 });
    }
    const result = await setPin(body.staffId, body.pin);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  return NextResponse.json({ ok: false, error: "Nothing to do" }, { status: 400 });
}
