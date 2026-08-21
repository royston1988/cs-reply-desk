"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Scoreboard } from "@/lib/scoreboard";

function mins(v: number | null): string {
  if (v === null) return "—";
  if (v < 60) return `${Math.round(v)} min`;
  const h = v / 60;
  if (h < 24) return `${h.toFixed(1)} hours`;
  return `${(h / 24).toFixed(1)} days`;
}

/** Under 1h good, under 6h warning, worse than that is the problem zone. */
function tone(v: number | null) {
  if (v === null) return "text-neutral-400";
  if (v <= 60) return "text-emerald-700";
  if (v <= 360) return "text-amber-700";
  return "text-red-600";
}

export default function ScoreboardPage() {
  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/scoreboard", { cache: "no-store" });
        if (res.status === 401 || res.status === 403) {
          setLocked(true);
          return;
        }
        setBoard(await res.json());
      } catch {
        setLocked(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-[13px] text-neutral-400">
        Working out your reply speed…
      </div>
    );
  }

  if (locked || !board?.ok) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[14px] font-medium">You need to sign in first.</p>
        <Link href="/" className="text-[13px] text-neutral-500 underline">
          Go to the Inbox and enter the PIN
        </Link>
      </div>
    );
  }

  const worst = board.byTopic.filter((t) => t.conversations >= 20).slice(0, 3);

  return (
    <div className="min-h-screen bg-[var(--ac-paper)]">
      {/* header */}
      <header className="flex h-14 items-center gap-6 border-b border-[var(--ac-line)] bg-white px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--ac-ink)] text-[13px] font-semibold text-white">
            AC
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Reply Desk</span>
        </div>
        <nav className="flex items-center gap-1">
          <Link href="/" className="rounded-lg px-3 py-1.5 text-[13px] text-neutral-500 hover:bg-neutral-100">
            Inbox
          </Link>
          <span className="rounded-lg bg-neutral-100 px-3 py-1.5 text-[13px] font-semibold">Scoreboard</span>
        </nav>
        <span className="ml-auto text-[11px] text-neutral-500">
          Based on the most recent {board.sampleSize.toLocaleString()} conversations
          {board.newestDate ? ` · newest ${board.newestDate.slice(0, 10)}` : ""}
        </span>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-6">
        {/* the headline pair */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--ac-line)] bg-white p-6">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Counting everything
            </div>
            <div className="mt-2 text-[34px] font-semibold leading-none">
              {mins(board.all.medianMins)}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
              Typical wait for a first reply, including the automated menu replies.
              This is the flattering number.
            </p>
          </div>

          <div className="rounded-2xl border-2 border-[var(--ac-ink)] bg-white p-6">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-700">
              Real people, real questions
            </div>
            <div className={`mt-2 text-[34px] font-semibold leading-none ${tone(board.human.medianMins)}`}>
              {mins(board.human.medianMins)}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-neutral-600">
              Same period, counting only customers who actually typed something.
              <strong className="text-neutral-900"> This is the number that matters.</strong>
            </p>
          </div>
        </section>

        {/* how many get answered fast */}
        <section className="rounded-2xl border border-[var(--ac-line)] bg-white p-6">
          <h2 className="text-[14px] font-semibold">How many real customers get answered in time</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Within 15 minutes", v: board.human.pctWithin15m },
              { label: "Within 1 hour", v: board.human.pctWithin1h },
              { label: "Within 6 hours", v: board.human.pctWithin6h },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-[26px] font-semibold leading-none">{s.v}%</div>
                <div className="mt-1 text-[12px] text-neutral-500">{s.label}</div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-[var(--ac-ink)]" style={{ width: `${s.v}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 border-t border-[var(--ac-line)] pt-3 text-[12px] leading-relaxed text-neutral-600">
            <strong>{(100 - board.human.pctWithin6h).toFixed(1)}%</strong> of real customers wait more
            than six hours. A further <strong>{board.human.neverAnswered.toLocaleString()}</strong>
            {" "}never received a reply at all in this sample.
          </p>
        </section>

        {/* slowest topics */}
        <section className="rounded-2xl border border-[var(--ac-line)] bg-white p-6">
          <h2 className="text-[14px] font-semibold">Which questions wait longest</h2>
          <p className="mt-1 text-[12px] text-neutral-500">Slowest at the top. This is where customers get lost.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--ac-line)] text-left text-[11px] uppercase tracking-wide text-neutral-500">
                  <th className="pb-2 font-semibold">Topic</th>
                  <th className="pb-2 text-right font-semibold">Conversations</th>
                  <th className="pb-2 text-right font-semibold">Typical wait</th>
                  <th className="pb-2 text-right font-semibold">Answered in 6h</th>
                  <th className="pb-2 text-right font-semibold">Never answered</th>
                </tr>
              </thead>
              <tbody>
                {board.byTopic.map((t) => (
                  <tr key={t.topic} className="border-b border-[var(--ac-line)] last:border-0">
                    <td className="py-2.5 font-medium">
                      {t.topic}
                      {t.topic === "Complaint" && (
                        <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                          worst place to be slow
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-neutral-600">{t.conversations.toLocaleString()}</td>
                    <td className={`py-2.5 text-right font-semibold ${tone(t.medianMins)}`}>{mins(t.medianMins)}</td>
                    <td className="py-2.5 text-right text-neutral-600">{t.pctWithin6h}%</td>
                    <td className="py-2.5 text-right text-neutral-600">
                      {t.neverAnswered ? t.neverAnswered.toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {worst.length > 0 && (
            <p className="mt-4 rounded-xl bg-neutral-50 p-4 text-[12.5px] leading-relaxed text-neutral-700">
              <strong>Worth acting on:</strong> your three slowest topics are{" "}
              {worst.map((w, i) => (
                <span key={w.topic}>
                  {i > 0 && (i === worst.length - 1 ? " and " : ", ")}
                  <strong>{w.topic}</strong> ({mins(w.medianMins)})
                </span>
              ))}
              . Fixing the slowest one moves more than shaving minutes off the fast ones.
            </p>
          )}
        </section>

        {/* the honest limitation */}
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-[13px] font-semibold text-amber-900">Why there are no per-person scores here</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-amber-800">
            The stored records look like they name who handled each chat, but that name is
            produced by a rule — every shipping question is labelled &ldquo;Chin Pui&rdquo;, every stock
            question &ldquo;Evelyn&rdquo;, every complaint &ldquo;Yan&rdquo;. Scoring your team on that would be
            scoring a lookup table, not their work. Per-person numbers become real once replies
            are sent from this app.
          </p>
        </section>
      </main>
    </div>
  );
}
