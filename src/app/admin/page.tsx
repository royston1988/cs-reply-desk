"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Rule, TeamRow } from "@/lib/points";
import type { Staff } from "@/lib/staff";

type Payload = { ok: boolean; error?: string; rules: Rule[]; team: TeamRow[]; people: Staff[] };

export default function AdminPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [adjust, setAdjust] = useState<{ staffId: string; points: string; note: string }>({
    staffId: "", points: "", note: "",
  });
  const [pinFor, setPinFor] = useState<{ staffId: string; pin: string }>({ staffId: "", pin: "" });
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || !body.ok) setError(body.error ?? "Admins only.");
      else {
        setData(body);
        setDraft(Object.fromEntries(body.rules.map((r: Rule) => [r.action, r.points])));
        setError(null);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function post(body: Record<string, unknown>, key: string, msg: string) {
    setSaving(key);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const r = await res.json();
      setFlash(r.ok ? msg : r.error ?? "Did not save");
      setTimeout(() => setFlash(null), 3000);
      if (r.ok) await load();
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-[13px] text-neutral-400">Loading…</div>;
  }

  if (error || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="max-w-sm text-[14px] font-medium">{error}</p>
        <Link href="/" className="text-[13px] text-neutral-500 underline">Back to the Inbox</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ac-paper)]">
      <header className="flex h-14 items-center gap-6 border-b border-[var(--ac-line)] bg-white px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--ac-ink)] text-[13px] font-semibold text-white">AC</div>
          <span className="text-[15px] font-semibold tracking-tight">Reply Desk</span>
        </div>
        <nav className="flex items-center gap-1">
          <Link href="/" className="rounded-lg px-3 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-100">Inbox</Link>
          <Link href="/cases" className="rounded-lg px-3 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-100">Cases</Link>
          <Link href="/me" className="rounded-lg px-3 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-100">My points</Link>
          <Link href="/scoreboard" className="rounded-lg px-3 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-100">Scoreboard</Link>
          <span className="rounded-lg bg-neutral-100 px-3 py-1.5 text-[13px] font-semibold">Admin</span>
        </nav>
        {flash && <span className="ml-auto rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium text-emerald-800">{flash}</span>}
      </header>

      <main className="mx-auto max-w-4xl space-y-5 p-6">
        {/* point values */}
        <section className="rounded-2xl border border-[var(--ac-line)] bg-white p-6">
          <h2 className="text-[14px] font-semibold">What each task is worth</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-500">
            Change a number and press Save. New values apply to points earned from then on —
            points already given stay as they were, so nobody&rsquo;s score changes retroactively.
          </p>
          <table className="mt-4 w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--ac-line)] text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="pb-2 font-semibold">Task</th>
                <th className="pb-2 text-right font-semibold">Points</th>
                <th className="pb-2 text-right font-semibold">On</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {data.rules.map((r) => (
                <tr key={r.action} className="border-b border-[var(--ac-line)] last:border-0">
                  <td className="py-3 pr-3">{r.label}</td>
                  <td className="py-3 text-right">
                    <input
                      type="number"
                      value={draft[r.action] ?? r.points}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.action]: Number(e.target.value) }))}
                      className="w-20 rounded-lg border border-[var(--ac-line)] px-2 py-1 text-right"
                    />
                  </td>
                  <td className="py-3 text-right">
                    <input
                      type="checkbox"
                      checked={r.active}
                      onChange={(e) => post({ type: "rule", action: r.action, active: e.target.checked }, r.action, "Saved")}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="py-3 pl-3 text-right">
                    <button
                      onClick={() => post({ type: "rule", action: r.action, points: draft[r.action] }, r.action, "Saved")}
                      disabled={saving === r.action || draft[r.action] === r.points}
                      className="rounded-lg bg-[var(--ac-ink)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-25"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* team totals */}
        <section className="rounded-2xl border border-[var(--ac-line)] bg-white p-6">
          <h2 className="text-[14px] font-semibold">Everyone&rsquo;s points</h2>
          <table className="mt-3 w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--ac-line)] text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="pb-2 font-semibold">Person</th>
                <th className="pb-2 text-right font-semibold">Today</th>
                <th className="pb-2 text-right font-semibold">7 days</th>
                <th className="pb-2 text-right font-semibold">Month</th>
                <th className="pb-2 text-right font-semibold">All time</th>
              </tr>
            </thead>
            <tbody>
              {data.team.map((t) => (
                <tr key={t.staffId} className="border-b border-[var(--ac-line)] last:border-0">
                  <td className="py-2.5 font-medium">{t.name}</td>
                  <td className="py-2.5 text-right text-neutral-600">{t.today}</td>
                  <td className="py-2.5 text-right text-neutral-600">{t.week}</td>
                  <td className="py-2.5 text-right font-semibold">{t.month}</td>
                  <td className="py-2.5 text-right text-neutral-600">{t.allTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* manual adjustment */}
        <section className="rounded-2xl border border-[var(--ac-line)] bg-white p-6">
          <h2 className="text-[14px] font-semibold">Add or take away points by hand</h2>
          <p className="mt-1 text-[12.5px] text-neutral-500">
            For work the system can&rsquo;t see — a phone call, a walk-in, a mistake to correct.
            Use a minus sign to deduct. Every adjustment is recorded with your name.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={adjust.staffId}
              onChange={(e) => setAdjust((a) => ({ ...a, staffId: e.target.value }))}
              className="rounded-lg border border-[var(--ac-line)] px-3 py-2 text-[13px]"
            >
              <option value="">Who…</option>
              {data.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input
              type="number"
              placeholder="Points"
              value={adjust.points}
              onChange={(e) => setAdjust((a) => ({ ...a, points: e.target.value }))}
              className="w-24 rounded-lg border border-[var(--ac-line)] px-3 py-2 text-[13px]"
            />
            <input
              placeholder="Reason (shown to them)"
              value={adjust.note}
              onChange={(e) => setAdjust((a) => ({ ...a, note: e.target.value }))}
              className="min-w-[220px] flex-1 rounded-lg border border-[var(--ac-line)] px-3 py-2 text-[13px]"
            />
            <button
              onClick={() => post(
                { type: "adjust", staffId: adjust.staffId, points: Number(adjust.points), note: adjust.note },
                "adjust", "Points adjusted",
              )}
              disabled={!adjust.staffId || !adjust.points || !adjust.note || saving === "adjust"}
              className="rounded-lg bg-[var(--ac-ink)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-25"
            >
              Apply
            </button>
          </div>
        </section>

        {/* PINs */}
        <section className="rounded-2xl border border-[var(--ac-line)] bg-white p-6">
          <h2 className="text-[14px] font-semibold">Change someone&rsquo;s PIN</h2>
          <p className="mt-1 text-[12.5px] text-neutral-500">
            The starting PINs are simple ones — change them once everybody has logged in.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={pinFor.staffId}
              onChange={(e) => setPinFor((p) => ({ ...p, staffId: e.target.value }))}
              className="rounded-lg border border-[var(--ac-line)] px-3 py-2 text-[13px]"
            >
              <option value="">Who…</option>
              {data.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input
              type="password"
              placeholder="New PIN (4+ characters)"
              value={pinFor.pin}
              onChange={(e) => setPinFor((p) => ({ ...p, pin: e.target.value }))}
              className="w-56 rounded-lg border border-[var(--ac-line)] px-3 py-2 text-[13px]"
            />
            <button
              onClick={() => { post({ type: "pin", staffId: pinFor.staffId, pin: pinFor.pin }, "pin", "PIN changed"); setPinFor({ staffId: "", pin: "" }); }}
              disabled={!pinFor.staffId || pinFor.pin.length < 4 || saving === "pin"}
              className="rounded-lg bg-[var(--ac-ink)] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-25"
            >
              Change
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
