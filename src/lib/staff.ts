import crypto from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-person sign-in.
 *
 * Points only mean something if we know who did the work, so a shared team PIN
 * isn't enough — each CS person gets their own code. The PIN itself is never
 * stored, only a hash of it.
 *
 * If the cs_staff table doesn't exist yet, everything falls back to the shared
 * APP_PIN so the app keeps working.
 */

export const STAFF_COOKIE = "cs_desk_staff";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";

export type Staff = { id: string; name: string; role: "cs" | "admin" };

export function db(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

export function hashPin(id: string, pin: string): string {
  return crypto.createHash("sha256").update(`${id}:${pin}:cs-reply-desk`).digest("hex");
}

/** Who can sign in. Empty array means the staff table isn't set up yet. */
export async function listStaff(): Promise<Staff[]> {
  const supabase = db();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("cs_staff")
    .select("id, name, role")
    .eq("active", true)
    .order("name");
  if (error) return [];
  return (data ?? []) as Staff[];
}

/** Returns the cookie value on success, null on a wrong PIN. */
export async function signIn(id: string, pin: string): Promise<{ cookie: string; staff: Staff } | null> {
  const supabase = db();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("cs_staff")
    .select("id, name, role, pin_hash, active")
    .eq("id", id)
    .maybeSingle();
  if (error || !data || !(data as { active: boolean }).active) return null;

  const row = data as { id: string; name: string; role: "cs" | "admin"; pin_hash: string };
  const given = hashPin(id, pin);
  const a = Buffer.from(given);
  const b = Buffer.from(row.pin_hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return {
    cookie: `${row.id}.${row.pin_hash}`,
    staff: { id: row.id, name: row.name, role: row.role },
  };
}

/** Who is this request? null when not signed in as a person. */
export async function whoIs(cookieValue?: string): Promise<Staff | null> {
  if (!cookieValue || !cookieValue.includes(".")) return null;
  const idx = cookieValue.indexOf(".");
  const id = cookieValue.slice(0, idx);
  const token = cookieValue.slice(idx + 1);

  const supabase = db();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("cs_staff")
    .select("id, name, role, pin_hash, active")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as { id: string; name: string; role: "cs" | "admin"; pin_hash: string; active: boolean };
  if (!row.active) return null;
  const a = Buffer.from(token);
  const b = Buffer.from(row.pin_hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  return { id: row.id, name: row.name, role: row.role };
}

export async function setPin(id: string, newPin: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = db();
  if (!supabase) return { ok: false, error: "No database." };
  const { error } = await supabase
    .from("cs_staff")
    .update({ pin_hash: hashPin(id, newPin) })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
