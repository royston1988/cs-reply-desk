"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CaseRow, CaseStatus, CasesResult } from "@/lib/cases";

const OWNERS = ["Chin Pui", "Evelyn", "Yan"];

const TABS: { key: "overdue" | "open" | "waiting_customer" | "done"; label: string; cn: string }[] = [
  { key: "overdue", label: "Overdue", cn: "超时" },
  { key: "open", label: "Open", cn: "待处理" },
  { key: "waiting_customer", label: "Waiting on her", cn: "等客户" },
  { key: "done", label: "Done", cn: "已完成" },
];

function waitLabel(m: number): string {
  if (m <= 0) return "—";
  if (m < 60) return `${m} min`;
  const h = m / 60;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${Math.round(h / 24)} days`;
}

export default function CasesPage() {
  const [data, setData] = useState<CasesResult | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overdue");
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cases", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        setLocked(true);
        return;
      }
      setData(await res.json());
    } catch {
      setLocked(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(c: CaseRow, body: { status?: CaseStatus; owner?: string }) {
    if (data?.stateTableMissing) return;
    setSaving(c.id);
    try {
      await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convId: c.id, ...body }),
      });
      await load();
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-[13px] text-neutral-400">
        Loading cases…
      </div>
    );
  }

  if (locked || !data?.ok) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[14px] font-medium">You need to sign in first.</p>
        <Link href="/" className="text-[13px] text-neutral-500 underline">
          Go to the Inbox and enter the PIN
        </Link>
      </div>
    );
  }

  const visible = data.cases.filter((c) =>
    tab === "overdue" ? c.overdue : c.status === tab,
  );

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
          <Link href="/" className="rounded-lg px-3 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-100">
            Inbox
          </Link>
          <span className="rounded-lg bg-neutral-100 px-3 py-1.5 text-[13px] font-semibold">Cases</span>
          <Link href="/scoreboard" className="rounded-lg px-3 py-1.5 text-[13px] text-neutral-600 hover:bg-neutral-100">
            Scoreboard
          </Link>
        </nav>
        <button
          onClick={load}
          className="ml-auto rounded-lg border border-[var(--ac-line)] px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Refresh
        </button>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 p-6">
        {data.stateTableMissing && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[12.5px] leading-relaxed text-amber-900">
            <strong>Read-only right now.</strong> The board can show cases but can&rsquo;t remember
            who owns them or which are done, because the <code>cs_cases</code> table doesn&rsquo;t exist
            yet. Roy has the one-off SQL to create it — after that, the buttons below start working.
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border-2 border-red-200 bg-white p-4">
            <div className="text-[26px] font-semibold leading-none text-red-600">{data.counts.overdue}</div>
            <div className="mt-1 text-[12px] text-neutral-600">Overdue — waiting over 6 hours</div>
          </div>
          <div className="rounded-xl border border-[var(--ac-line)] bg-white p-4">
            <div className="text-[26px] font-semibold leading-none">{data.counts.open}</div>
            <div className="mt-1 text-[12px] text-neutral-600">Open — she&rsquo;s waiting on us</div>
          </div>
          <div className="rounded-xl border border-[var(--ac-line)] bg-white p-4">
            <div className="text-[26px] font-semibold leading-none text-neutral-400">{data.counts.done}</div>
            <div className="mt-1 text-[12px] text-neutral-600">Closed</div>
          </div>
        </section>

        <div className="flex gap-1 rounded-xl border border-[var(--ac-line)] bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                "flex-1 rounded-lg px-3 py-2 text-[12.5px] transition",
                tab === t.key ? "bg-neutral-100 font-semibold" : "text-neutral-500 hover:bg-neutral-50",
              ].join(" ")}
            >
              {t.label} <span className="opacity-60">{t.cn}</span>
            </button>
          ))}
        </div>

        <section className="space-y-2">
          {visible.length === 0 && (
            <p className="rounded-xl border border-[var(--ac-line)] bg-white p-8 text-center text-[13px] text-neutral-400">
              Nothing here. {tab === "overdue" ? "Nobody is overdue right now." : ""}
            </p>
          )}

          {visible.map((c) => (
            <article
              key={c.id}
              className={[
                "rounded-xl border bg-white p-4",
                c.overdue ? "border-red-200" : "border-[var(--ac-line)]",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={[
                    "rounded px-2 py-0.5 text-[11px] font-semibold",
                    c.kind === "Complaint"
                      ? "bg-red-100 text-red-700"
                      : c.kind === "Exchange"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-neutral-100 text-neutral-700",
                  ].join(" ")}
                >
                  {c.kind}
                </span>
                <span className="text-[13.5px] font-semibold">{c.name}</span>

                {c.waitingMins > 0 && (
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      c.overdue ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700",
                    ].join(" ")}
                  >
                    waiting {waitLabel(c.waitingMins)}
                  </span>
                )}

                {c.neverAnswered && (
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                    never answered
                  </span>
                )}

                {c.owner && (
                  <span className="ml-auto text-[11.5px] text-neutral-500">owner: {c.owner}</span>
                )}
              </div>

              <p className="mt-2 line-clamp-2 text-[13px] text-neutral-700">
                <span className="text-neutral-400">
                  {c.lastFrom === "customer" ? "She said: " : "We said: "}
                </span>
                {c.lastMessage}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--ac-line)] pt-3">
                <select
                  value={c.owner}
                  disabled={data.stateTableMissing || saving === c.id}
                  onChange={(e) => patch(c, { owner: e.target.value })}
                  className="rounded-lg border border-[var(--ac-line)] bg-white px-2 py-1.5 text-[12px] disabled:opacity-40"
                >
                  <option value="">Assign to…</option>
                  {OWNERS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>

                {c.status !== "done" ? (
                  <button
                    onClick={() => patch(c, { status: "done" })}
                    disabled={data.stateTableMissing || saving === c.id}
                    className="rounded-lg bg-[var(--ac-ink)] px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-30"
                  >
                    {saving === c.id ? "Saving…" : "Mark done 完成"}
                  </button>
                ) : (
                  <button
                    onClick={() => patch(c, { status: "open" })}
                    disabled={data.stateTableMissing || saving === c.id}
                    className="rounded-lg border border-[var(--ac-line)] px-3 py-1.5 text-[12px] font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
                  >
                    Reopen
                  </button>
                )}

                <Link
                  href="/"
                  className="ml-auto text-[12px] text-neutral-500 underline hover:text-neutral-800"
                >
                  open the chat
                </Link>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
