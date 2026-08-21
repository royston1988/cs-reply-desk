import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, isSignedIn, pinRequired } from "@/lib/auth";
import { STAFF_COOKIE, listStaff, whoIs } from "@/lib/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Two ways in:
 *   "staff" — the cs_staff table exists, so everyone signs in as themselves
 *             (needed for points to mean anything)
 *   "pin"   — no staff set up yet, fall back to the shared APP_PIN
 */
export async function GET() {
  const jar = await cookies();
  const staff = await whoIs(jar.get(STAFF_COOKIE)?.value);
  const people = await listStaff();

  if (people.length) {
    return NextResponse.json(
      {
        mode: "staff",
        required: true,
        signedIn: Boolean(staff),
        staff,
        people: people.map((p) => ({ id: p.id, name: p.name })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      mode: "pin",
      required: pinRequired(),
      signedIn: isSignedIn(jar.get(SESSION_COOKIE)?.value),
      staff: null,
      people: [],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
