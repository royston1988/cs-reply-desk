import { NextResponse } from "next/server";
import { SESSION_COOKIE, pinRequired, sessionToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!pinRequired()) {
    return NextResponse.json({ ok: true, note: "No PIN is set." });
  }

  let pin = "";
  try {
    const body = await request.json();
    pin = String(body?.pin ?? "");
  } catch {
    /* empty body */
  }

  if (pin !== process.env.APP_PIN) {
    // Slow a little so guessing repeatedly is tedious.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ ok: false, error: "Wrong PIN" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionToken()!, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // signed in for the working day
  });
  return res;
}

/** Sign out. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
