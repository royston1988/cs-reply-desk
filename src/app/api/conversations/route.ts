import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, isSignedIn } from "@/lib/auth";
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
  const jar = await cookies();
  if (!isSignedIn(jar.get(SESSION_COOKIE)?.value)) {
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
