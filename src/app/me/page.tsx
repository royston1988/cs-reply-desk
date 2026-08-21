"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MyStats, Rule, TeamRow } from "@/lib/points";
import type { Staff } from "@/lib/staff";

type Payload = {
  ok: boolean;
  error?: string;
  staff: Staff;
  stats: MyStats;
  rules: Rule[];
  team: TeamRow[];
};

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function MyPointsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        const body = await res.json();
        if (!res.ok || !body.ok) setError(body.error ?? "Please sign in.");
        else setData(body);
      } catch {
        setError("Could not reach the server.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-[13px] text-neutral-400">Loading…</div>;
  }

  if (error || !data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="max-w-sm text-[14px] font-medium">{error}</p>
        <Link href="/" className="text-[13px] text-neutral-500 underline">
          Go to the Inbox and sign in
        </Link>
      </div>
    );
  }

  const { staff, stats, rules, team } = data;
  const rank = team.findIndex((t) => t.staffId === staff.id) + 1;
  const topMonth = Math.max(1, ...team.map((t) => t.month));

  return (
    <div className="min-h-screen bg-[var(--ac-paper)]">
      <header className="flex h-14 items-center gap-6 border-b border-[var(--ac-line)] bg-white px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--ac-ink)] text-[13px] font-semibold text-white">
            AC
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Reply Desk</span>
        </div>
        <nav className="flex items-center gap-1">
          <Link href="/" className="rounded-lg px-3 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-100">Inbox</Link>
          <Link href="/cases" className="rounded-lg px-3 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-100">Cases</Link>
          <span className="rounded-lg bg-neutral-100 px-3 py-1.5 text-[13px] font-semibold">My points</span>
          <Link href="/scoreboard" className="rounded-lg px-3 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-100">Scoreboard</Link>
          {staff.role === "admin" && (
            <Link href="/admin" className="rounded-lg px-3 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-100">Admin</Link>
          )}
        </nav>
        <span className="ml-auto text-[12px] text-neutral-600">
          {staff.name}
          {staff.role === "admin" && <span className="ml-1.5 rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] text-white">admin</span>}
        </span>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 p-6">
        <section className="rounded-2xl border-2 border-[var(--ac-ink)] bg-white p-6">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Your points this month 这个月的分数
          </div>
          <div className="mt-1 flex items-end gap-4">
            <div className="text-[46px] font-semibold leading-none">{stats.month}</div>
            {rank > 0 && (
              <div className="pb-2 text-[13px] text-neutral-500">
                #{rank} of {team.length} on the team
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Today 今天", v: stats.today },
            { label: "Last 7 days 这星期", v: stats.week },
            { label: "All time 总共", v: stats.allTime },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-[var(--ac-line)] bg-white p-4">
              <div className="text-[24px] font-semibold leading-none">{s.v}</div>
              <div className="mt-1 text-[12px] text-neutral-500">{s.label}</div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-[var(--ac-line)] bg-white p-6">
          <h2 className="text-[14px] font-semibold">Where your points came from</h2>
          {stats.byAction.length === 0 ? (
            <p className="mt-3 text-[13px] text-neutral-500">
              Nothing yet. Close a case on the Cases page and points appear here.
            </p>
          ) : (
            <table className="mt-3 w-full text-[13px]">
              <tbody>
                {stats.byAction.map((a) => (
                  <tr key={a.action} className="border-b border-[var(--ac-line)] last:border-0">
                    <td className="py-2.5">{a.label}</td>
                    <td className="py-2.5 text-right text-neutral-500">× {a.count}</td>
                    <td className="py-2.5 text-right font-semibold">{a.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--ac-line)] bg-white p-6">
          <h2 className="text-[14px] font-semibold">How to earn 怎么拿分</h2>
          <p className="mt-1 text-[12px] text-neutral-500">
            The slow, difficult ones are worth the most on purpose.
          </p>
          <table className="mt-3 w-full text-[13px]">
            <tbody>
              {rules.filter((r) => r.active).map((r) => (
                <tr key={r.action} className="border-b border-[var(--ac-line)] last:border-0">
                  <td className="py-2.5">{r.label}</td>
                  <td className="py-2.5 text-right font-semibold">+{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-[var(--ac-line)] bg-white p-6">
          <h2 className="text-[14px] font-semibold">The team this month</h2>
          <div className="mt-3 space-y-2.5">
            {team.map((t, i) => (
              <div key={t.staffId} className="flex items-center gap-3">
                <span className="w-5 text-[12px] text-neutral-400">{i + 1}</span>
                <span className={`w-28 shrink-0 text-[13px] ${t.staffId === staff.id ? "font-semibold" : ""}`}>
                  {t.name}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={`h-full rounded-full ${t.staffId === staff.id ? "bg-[var(--ac-ink)]" : "bg-neutral-300"}`}
                    style={{ width: `${(t.month / topMonth) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right text-[13px] font-medium">{t.month}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--ac-line)] bg-white p-6">
          <h2 className="text-[14px] font-semibold">Recent</h2>
          {stats.recent.length === 0 ? (
            <p className="mt-3 text-[13px] text-neutral-500">Nothing yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {stats.recent.map((r) => (
                <li key={r.id} className="flex items-center gap-3 border-b border-[var(--ac-line)] pb-2 text-[12.5px] last:border-0">
                  <span className={`w-9 shrink-0 font-semibold ${r.points < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {r.points > 0 ? "+" : ""}{r.points}
                  </span>
                  <span className="flex-1 text-neutral-700">
                    {rules.find((x) => x.action === r.action)?.label ?? r.action}
                    {r.note && <span className="text-neutral-400"> · {r.note}</span>}
                  </span>
                  <span className="shrink-0 text-neutral-400">{when(r.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
