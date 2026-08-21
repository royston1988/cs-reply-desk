import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, isSignedIn, pinRequired } from "./auth";
import { STAFF_COOKIE, listStaff, whoIs, type Staff } from "./staff";

/**
 * One door for every route that returns real customer data.
 *
 * Order matters: a signed-in person wins, then the shared PIN, and if neither
 * lock exists at all the answer is still no. Forgetting to configure a lock
 * must never mean "let everyone in" — that mistake already put 124 real
 * conversations on the open internet once.
 */
export async function requireUser(): Promise<
  { ok: true; staff: Staff | null } | { ok: false; response: NextResponse }
> {
  const jar = await cookies();

  const staff = await whoIs(jar.get(STAFF_COOKIE)?.value);
  if (staff) return { ok: true, staff };

  const people = await listStaff();
  if (people.length) {
    // Per-person sign-in is set up, so the shared PIN is no longer accepted.
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Locked" }, { status: 401 }),
    };
  }

  if (!pinRequired()) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "No PIN is set, so real data is switched off." },
        { status: 403 },
      ),
    };
  }

  if (isSignedIn(jar.get(SESSION_COOKIE)?.value)) return { ok: true, staff: null };

  return {
    ok: false,
    response: NextResponse.json({ ok: false, error: "Locked" }, { status: 401 }),
  };
}
