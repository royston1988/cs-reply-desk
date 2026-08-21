import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, isSignedIn, pinRequired } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Does this visitor need to enter a PIN, and have they already? */
export async function GET() {
  const jar = await cookies();
  return NextResponse.json(
    {
      required: pinRequired(),
      signedIn: isSignedIn(jar.get(SESSION_COOKIE)?.value),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
