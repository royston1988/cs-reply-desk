import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { fetchScoreboard } from "@/lib/scoreboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const board = await fetchScoreboard();
  return NextResponse.json(board, { headers: { "Cache-Control": "no-store" } });
}
