import { NextResponse } from "next/server";
import { fetchArchive } from "@/lib/cs-archive";
import { fetchConversations } from "@/lib/facebook";

export const dynamic = "force-dynamic";

/**
 * Where the conversations come from, best first:
 *   1. Supabase — the real archive already collected (needs SUPABASE_SERVICE_KEY)
 *   2. Facebook  — live messages (needs FB_PAGE_TOKEN, currently expired)
 *   3. Samples   — so the screen is never blank
 */
export async function GET() {
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
