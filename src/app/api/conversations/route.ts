import { NextResponse } from "next/server";
import { requireUser } from "@/lib/guard";
import { fetchArchive } from "@/lib/cs-archive";
import { fetchConversations } from "@/lib/facebook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where the conversations come from, best first:
 *   1. Supabase — the real archive already collected (needs SUPABASE_SERVICE_KEY)
 *   2. Facebook  — live messages (needs FB_PAGE_TOKEN)
 *   3. Samples   — so the screen is never blank
 *
 * Nothing is returned at all until the visitor has passed the PIN gate.
 */
export async function GET() {
  // One door for everything that returns real customer data. If no lock is
  // configured at all the answer is still no — forgetting to set a lock must
  // never mean "let everyone in".
  const gate = await requireUser();
  if (!gate.ok) {
    return NextResponse.json(
      { connected: false, source: "locked", conversations: [] },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const archive = await fetchArchive();
  if (archive.connected && archive.conversations.length) {
    return NextResponse.json(
      {
        connected: true,
        source: "supabase",
        conversations: archive.conversations,
        noiseFiltered: archive.noiseFiltered ?? 0,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const live = await fetchConversations();
  if (live.connected && live.conversations.length) {
    return NextResponse.json(
      { connected: true, source: "facebook", conversations: live.conversations },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      connected: false,
      source: "sample",
      error: archive.error ?? live.error,
      conversations: [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
