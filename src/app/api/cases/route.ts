import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, isSignedIn, pinRequired } from "@/lib/auth";
import { fetchCases, saveCase, type CaseStatus } from "@/lib/cases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function guard() {
  if (!pinRequired()) return NextResponse.json({ ok: false, error: "No PIN is set." }, { status: 403 });
  const jar = await cookies();
  if (!isSignedIn(jar.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Locked" }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const blocked = await guard();
  if (blocked) return blocked;
  const result = await fetchCases();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const blocked = await guard();
  if (blocked) return blocked;

  let body: { convId?: string; status?: CaseStatus; owner?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  }
  if (!body.convId) return NextResponse.json({ ok: false, error: "Missing case id" }, { status: 400 });

  const result = await saveCase(body.convId, {
    status: body.status,
    owner: body.owner,
    note: body.note,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
