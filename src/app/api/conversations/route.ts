import { NextResponse } from "next/server";
import { fetchConversations } from "@/lib/facebook";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchConversations();
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
