import { NextResponse } from "next/server";
import { syncFacebookToSupabase } from "@/lib/fb-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Pull the newest Facebook conversations into Supabase. Visit /api/sync to run. */
export async function GET() {
  const result = await syncFacebookToSupabase();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 400,
    headers: { "Cache-Control": "no-store" },
  });
}
