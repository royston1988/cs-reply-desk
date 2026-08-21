import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, isSignedIn, pinRequired } from "@/lib/auth";
import { fetchScoreboard } from "@/lib/scoreboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  // Same fail-safe as the inbox: no PIN configured means no real data leaves here.
  if (!pinRequired()) {
    return NextResponse.json({ ok: false, error: "No PIN is set." }, { status: 403 });
  }
  const jar = await cookies();
  if (!isSignedIn(jar.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Locked" }, { status: 401 });
  }

  const board = await fetchScoreboard();
  return NextResponse.json(board, { headers: { "Cache-Control": "no-store" } });
}
