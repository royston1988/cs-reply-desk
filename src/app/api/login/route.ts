import { NextResponse } from "next/server";
import { SESSION_COOKIE, pinRequired, sessionToken } from "@/lib/auth";
import { STAFF_COOKIE, listStaff, signIn } from "@/lib/staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 12, // one working day
};

export async function POST(request: Request) {
  let staffId = "";
  let pin = "";
  try {
    const body = await request.json();
    staffId = String(body?.staffId ?? "");
    pin = String(body?.pin ?? "");
  } catch {
    /* empty body */
  }

  // Per-person sign-in, once the staff table exists.
  const people = await listStaff();
  if (people.length) {
    if (!staffId) {
      return NextResponse.json({ ok: false, error: "Pick your name first" }, { status: 400 });
    }
    const result = await signIn(staffId, pin);
    if (!result) {
      await new Promise((r) => setTimeout(r, 600)); // make guessing tedious
      return NextResponse.json({ ok: false, error: "Wrong PIN" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true, staff: result.staff });
    res.cookies.set(STAFF_COOKIE, result.cookie, COOKIE_OPTS);
    return res;
  }

  // Fallback: one shared PIN for the whole team.
  if (!pinRequired()) return NextResponse.json({ ok: true, note: "No PIN is set." });
  if (pin !== process.env.APP_PIN) {
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ ok: false, error: "Wrong PIN" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionToken()!, COOKIE_OPTS);
  return res;
}

/** Sign out of both kinds of session. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(STAFF_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
