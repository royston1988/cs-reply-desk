import crypto from "crypto";

/**
 * A simple shared PIN gate.
 *
 * Deliberately modest: it keeps casual visitors out of the demo. It is NOT
 * strong enough to guard real customer conversations on a public URL — for
 * that we would need one account per person. Real data stays local.
 *
 * If APP_PIN is not set, the app is open (handy while developing).
 */

export const SESSION_COOKIE = "cs_desk_session";

export function pinRequired(): boolean {
  return Boolean(process.env.APP_PIN);
}

/** The cookie value a correct PIN produces. Can't be guessed without the PIN. */
export function sessionToken(): string | null {
  const pin = process.env.APP_PIN;
  if (!pin) return null;
  return crypto.createHash("sha256").update(`${pin}:cs-reply-desk`).digest("hex");
}

export function isSignedIn(cookieValue?: string): boolean {
  const expected = sessionToken();
  if (!expected) return true; // no PIN configured — nothing to check
  if (!cookieValue) return false;
  // Constant-time compare so the check can't be probed character by character.
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
