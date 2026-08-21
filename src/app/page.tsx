"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AGENT,
  CONVERSATIONS,
  type Conversation,
  type Lang,
} from "@/lib/mock-data";

type Filter = "need_reply" | "waiting" | "done";

const FILTERS: { key: Filter; label: string; cn: string }[] = [
  { key: "need_reply", label: "Need reply", cn: "待回复" },
  { key: "waiting", label: "Waiting", cn: "等待中" },
  { key: "done", label: "Done", cn: "已完成" },
];

const LANGS: { key: Lang; label: string }[] = [
  { key: "en", label: "English" },
  { key: "zh", label: "中文" },
  { key: "mix", label: "Mixed" },
];

const NAV = [
  { label: "Inbox", cn: "收件箱", active: true },
  { label: "Cases", cn: "个案", active: false },
  { label: "Scoreboard", cn: "计分板", active: false },
  { label: "Answers", cn: "回复库", active: false },
];

/** Green under 15 min, amber under an hour, red past that. */
function waitTone(mins: number) {
  if (mins >= 60) return { dot: "bg-red-500", text: "text-red-600", bg: "bg-red-50" };
  if (mins >= 15) return { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" };
  return { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" };
}

function waitLabel(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function Page() {
  const [filter, setFilter] = useState<Filter>("need_reply");
  const [selectedId, setSelectedId] = useState("c1");
  const [lang, setLang] = useState<Lang>("en");
  const [copied, setCopied] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Filter>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [showHelp, setShowHelp] = useState(true);
  const [showOrder, setShowOrder] = useState(false);

  // ---- live Facebook messages (falls back to samples until connected) ----
  const [live, setLive] = useState<Conversation[] | null>(null);
  const [connected, setConnected] = useState(false);
  const [connError, setConnError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"supabase" | "facebook" | "sample">("sample");
  const [noiseFiltered, setNoiseFiltered] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      const data = await res.json();
      setConnected(Boolean(data.connected));
      setConnError(data.error ?? null);
      setSource(data.source ?? "sample");
      setNoiseFiltered(data.noiseFiltered ?? 0);
      setLive(data.connected ? data.conversations : null);
      if (data.connected && data.conversations?.length) {
        setSelectedId(data.conversations[0].id);
      }
    } catch {
      setConnected(false);
      setConnError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- PIN gate ----
  const [gate, setGate] = useState<"checking" | "locked" | "open">("checking");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [checkingPin, setCheckingPin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/session", { cache: "no-store" });
        const s = await res.json();
        if (s.required && !s.signedIn) {
          setGate("locked");
          return;
        }
      } catch {
        /* if the check fails, fall through and let the API decide */
      }
      setGate("open");
      load();
    })();
  }, [load]);

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim() || checkingPin) return;
    setCheckingPin(true);
    setPinError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        setGate("open");
        setPin("");
        load();
      } else {
        setPinError("That PIN isn't right. Try again.");
      }
    } catch {
      setPinError("Could not reach the server.");
    } finally {
      setCheckingPin(false);
    }
  }

  const convos = connected && live?.length ? live : CONVERSATIONS;

  const statusOf = (c: Conversation): Filter => overrides[c.id] ?? c.status;

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { need_reply: 0, waiting: 0, done: 0 };
    convos.forEach((c) => (base[statusOf(c)] += 1));
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides, convos]);

  const visible = convos.filter((c) => statusOf(c) === filter);
  const selected = convos.find((c) => c.id === selectedId) ?? convos[0];

  const suggestion =
    selected?.suggestions.find((s) => s.lang === lang) ?? selected?.suggestions[0];
  const hasSuggestion = Boolean(suggestion?.text);

  const editKey = `${selected?.id}:${lang}`;
  const replyText = edits[editKey] ?? (hasSuggestion ? suggestion!.text : "");
  const canReply = selected ? statusOf(selected) === "need_reply" : false;

  async function copyReply() {
    if (!replyText.trim()) return;
    try {
      await navigator.clipboard.writeText(replyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function markReplied() {
    if (!selected) return;
    setOverrides((o) => ({ ...o, [selected.id]: "done" }));
    const next = visible.find((c) => c.id !== selected.id);
    if (next) setSelectedId(next.id);
  }

  if (gate === "checking") {
    return (
      <div className="flex h-screen items-center justify-center text-[13px] text-neutral-400">
        Loading…
      </div>
    );
  }

  if (gate === "locked") {
    return (
      <div className="flex h-screen items-center justify-center px-6">
        <form
          onSubmit={submitPin}
          className="w-full max-w-sm rounded-2xl border border-[var(--ac-line)] bg-white p-8 shadow-[0_2px_12px_rgba(0,0,0,0.05)]"
        >
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--ac-ink)] text-[14px] font-semibold text-white">
              AC
            </div>
            <div className="leading-tight">
              <div className="text-[16px] font-semibold tracking-tight">Reply Desk</div>
              <div className="text-[11px] text-neutral-500">Ample Couture · Customer Service</div>
            </div>
          </div>

          <label className="mb-1.5 block text-[13px] font-medium">
            Enter PIN 输入密码
          </label>
          <input
            type="password"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setPinError(null);
            }}
            autoFocus
            inputMode="text"
            placeholder="••••••••"
            className="w-full rounded-xl border-2 border-[var(--ac-line)] bg-neutral-50 px-4 py-3 text-[15px] tracking-widest outline-none focus:border-neutral-400 focus:bg-white"
          />

          {pinError && (
            <p className="mt-2 text-[12px] font-medium text-red-600">{pinError}</p>
          )}

          <button
            type="submit"
            disabled={!pin.trim() || checkingPin}
            className="mt-4 w-full rounded-xl bg-[var(--ac-ink)] px-4 py-3 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-30"
          >
            {checkingPin ? "Checking…" : "Open 进入"}
          </button>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-neutral-400">
            Staff only. Customer conversations are private.
          </p>
        </form>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="flex h-screen items-center justify-center text-[14px] text-neutral-500">
        No conversations to show.
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* ---------------- top bar ---------------- */}
      <header className="flex h-14 shrink-0 items-center gap-6 border-b border-[var(--ac-line)] bg-white px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--ac-ink)] text-[13px] font-semibold text-white">
            AC
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Reply Desk</span>
        </div>

        <nav className="flex items-center gap-1">
          {NAV.map((n) => (
            <span
              key={n.label}
              className={[
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px]",
                n.active ? "bg-neutral-100 font-semibold" : "text-neutral-400",
              ].join(" ")}
            >
              {n.label}
              {!n.active && (
                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-500">
                  soon
                </span>
              )}
            </span>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-[var(--ac-line)] px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            {loading ? "Checking…" : "Refresh"}
          </button>

          {source === "supabase" ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Real customers from Supabase
              {noiseFiltered > 0 && (
                <span className="font-normal opacity-80">
                  · {noiseFiltered} button-taps hidden
                </span>
              )}
            </span>
          ) : source === "facebook" ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-medium text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live from Facebook
            </span>
          ) : (
            <span
              title={connError ?? undefined}
              className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-medium text-amber-800"
            >
              Sample messages — not connected yet
            </span>
          )}

          <div className="flex items-center gap-2 border-l border-[var(--ac-line)] pl-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-[11px] font-semibold text-neutral-700">
              CP
            </div>
            <span className="text-[12px] font-medium">{AGENT.name}</span>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------------- who is waiting ---------------- */}
        <section className="flex w-[300px] shrink-0 flex-col border-r border-[var(--ac-line)] bg-white">
          <div className="flex gap-1 border-b border-[var(--ac-line)] p-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={[
                  "flex-1 rounded-lg px-2 py-1.5 text-[12px] transition",
                  filter === f.key
                    ? "bg-neutral-100 font-semibold text-neutral-900"
                    : "text-neutral-500 hover:bg-neutral-50",
                ].join(" ")}
              >
                <div>{f.label}</div>
                <div className="text-[10px] opacity-70">{counts[f.key]}</div>
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {visible.length === 0 && (
              <p className="p-6 text-center text-[13px] text-neutral-400">Nothing here.</p>
            )}

            {visible.map((c) => {
              const tone = waitTone(c.waitingMins);
              const last = c.messages[c.messages.length - 1];
              const isOn = c.id === selected.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={[
                    "flex w-full gap-3 border-b border-[var(--ac-line)] px-4 py-3 text-left transition",
                    isOn
                      ? "bg-neutral-100 shadow-[inset_3px_0_0_var(--ac-ink)]"
                      : "hover:bg-neutral-50",
                  ].join(" ")}
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[12px] font-semibold text-neutral-700">
                    {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold">{c.name}</span>
                      {c.waitingMins > 0 && (
                        <span
                          className={`flex shrink-0 items-center gap-1 rounded-full ${tone.bg} px-2 py-0.5 text-[10px] font-medium ${tone.text}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                          {waitLabel(c.waitingMins)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-neutral-500">
                      {last?.text ?? ""}
                    </p>
                    <span className="mt-1.5 inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">
                      {c.topic}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ---------------- the conversation ---------------- */}
        <main className="flex min-w-0 flex-1 flex-col bg-[var(--ac-paper)]">
          <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--ac-line)] bg-white px-5">
            <div className="leading-tight">
              <div className="text-[14px] font-semibold">{selected.name}</div>
              <div className="text-[11px] text-neutral-500">
                {selected.channel === "messenger" ? "Messenger" : "WhatsApp"} · {selected.topic}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg border border-[var(--ac-line)] px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50">
                Create case
              </button>
              <button
                onClick={markReplied}
                disabled={!canReply}
                className="rounded-lg border border-[var(--ac-line)] px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
              >
                Mark replied
              </button>
            </div>
          </div>

          {/* one-line order facts, click to see everything */}
          {selected.order && (
            <div className="shrink-0 border-b border-[var(--ac-line)] bg-white px-5 py-2">
              <button
                onClick={() => setShowOrder((v) => !v)}
                className="flex w-full items-center gap-2 text-left"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    selected.order.statusTone === "ok"
                      ? "bg-emerald-500"
                      : selected.order.statusTone === "warn"
                        ? "bg-amber-500"
                        : "bg-red-500"
                  }`}
                />
                <span className="truncate text-[12px] text-neutral-600">
                  <span className="font-semibold text-neutral-800">{selected.order.orderNo}</span>
                  {" · "}
                  {selected.order.items} · {selected.order.value} · {selected.order.status}
                </span>
                <span className="ml-auto shrink-0 text-[11px] text-neutral-400">
                  {showOrder ? "hide" : "details"}
                </span>
              </button>
              {showOrder && (
                <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-[var(--ac-line)] pt-2 text-[12px]">
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Ordered</dt>
                    <dd className="font-medium">{selected.order.placed}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Courier</dt>
                    <dd className="font-medium">{selected.order.courier}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Paid</dt>
                    <dd className="font-medium">{selected.order.value}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-neutral-500">Tracking</dt>
                    <dd className="font-medium">{selected.order.tracking}</dd>
                  </div>
                </dl>
              )}
            </div>
          )}

          {/* how to use — dismissible */}
          {showHelp && (
            <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--ac-line)] bg-blue-50 px-5 py-2.5 text-[12px] text-blue-900">
              <span className="font-semibold">How to use 怎么用:</span>
              <span><b>1.</b> Pick a customer on the left</span>
              <span className="text-blue-300">→</span>
              <span><b>2.</b> Read her message</span>
              <span className="text-blue-300">→</span>
              <span><b>3.</b> Reply at the bottom, then click <b>Copy</b></span>
              <button
                onClick={() => setShowHelp(false)}
                className="ml-auto shrink-0 rounded px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-100"
              >
                Got it ✕
              </button>
            </div>
          )}

          {/* messages */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-6">
            {selected.messages.map((m) => (
              <div key={m.id} className={m.from === "customer" ? "flex" : "flex justify-end"}>
                <div className="max-w-[75%]">
                  <div
                    className={[
                      "rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap",
                      m.from === "customer"
                        ? "rounded-tl-sm bg-white text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                        : "rounded-tr-sm bg-[var(--ac-ink)] text-white",
                    ].join(" ")}
                  >
                    {m.text}
                  </div>
                  <div
                    className={[
                      "mt-1 text-[10px] text-neutral-400",
                      m.from === "customer" ? "" : "text-right",
                    ].join(" ")}
                  >
                    {m.agent ? `${m.agent} · ` : ""}
                    {m.time}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ---------------- the reply ---------------- */}
          <div className="shrink-0 border-t-2 border-[var(--ac-ink)] bg-white">
            {!canReply ? (
              <p className="px-5 py-6 text-center text-[13px] text-neutral-400">
                Already handled — nothing to reply.
              </p>
            ) : selected.writeItYourself ? (
              <div className="p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                    Write this one yourself 请自己写
                  </span>
                  <span className="text-[11.5px] text-red-700">{selected.riskNote}</span>
                </div>
                <textarea
                  value={edits[editKey] ?? ""}
                  onChange={(e) => setEdits((s) => ({ ...s, [editKey]: e.target.value }))}
                  placeholder={`Type your reply to ${selected.name.split(" ")[0]} here…`}
                  className="h-24 w-full resize-none rounded-xl border-2 border-red-200 bg-white p-3 text-[13.5px] leading-relaxed outline-none placeholder:text-neutral-400 focus:border-red-400"
                />
                <div className="mt-2 flex items-center gap-3">
                  <p className="flex-1 text-[11px] text-neutral-500">
                    <span className="font-semibold">Remember:</span>{" "}
                    {selected.suggestions[0]?.source}
                  </p>
                  <button
                    onClick={copyReply}
                    className="shrink-0 rounded-lg bg-[var(--ac-ink)] px-5 py-2.5 text-[13px] font-semibold text-white hover:opacity-90"
                  >
                    {copied ? "Copied ✓" : "Copy 复制"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  {hasSuggestion ? (
                    <>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        Reply written for you ✨
                      </span>
                      <span className="text-[11.5px] text-neutral-500">
                        Change anything you want, then copy it.
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="rounded bg-neutral-200 px-2 py-0.5 text-[11px] font-semibold text-neutral-700">
                        No suggestion yet
                      </span>
                      <span className="text-[11.5px] text-neutral-500">
                        AI reply writing is the next step. Type your reply for now.
                      </span>
                    </>
                  )}

                  {hasSuggestion && (
                    <div className="ml-auto flex gap-1 rounded-lg bg-neutral-100 p-0.5">
                      {LANGS.map((l) => (
                        <button
                          key={l.key}
                          onClick={() => setLang(l.key)}
                          className={[
                            "rounded-md px-3 py-1 text-[12px] transition",
                            lang === l.key
                              ? "bg-white font-semibold text-neutral-900 shadow-sm"
                              : "text-neutral-500 hover:text-neutral-700",
                          ].join(" ")}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <textarea
                  value={replyText}
                  onChange={(e) => setEdits((s) => ({ ...s, [editKey]: e.target.value }))}
                  placeholder={
                    hasSuggestion
                      ? undefined
                      : `Type your reply to ${selected.name.split(" ")[0]} here…`
                  }
                  className="h-24 w-full resize-none rounded-xl border-2 border-[var(--ac-line)] bg-neutral-50 p-3 text-[13.5px] leading-relaxed outline-none placeholder:text-neutral-400 focus:border-neutral-400 focus:bg-white"
                />

                <div className="mt-2 flex items-center gap-3">
                  <p className="flex-1 text-[11px] text-neutral-500">
                    {hasSuggestion && (
                      <>
                        <span className="font-semibold">Where this came from:</span>{" "}
                        {suggestion?.source}
                      </>
                    )}
                  </p>
                  {edits[editKey] !== undefined && hasSuggestion && (
                    <button
                      onClick={() =>
                        setEdits((s) => {
                          const n = { ...s };
                          delete n[editKey];
                          return n;
                        })
                      }
                      className="shrink-0 text-[11px] text-neutral-500 underline hover:text-neutral-800"
                    >
                      undo my changes
                    </button>
                  )}
                  <button
                    onClick={copyReply}
                    disabled={!replyText.trim()}
                    className="shrink-0 rounded-lg bg-[var(--ac-ink)] px-6 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-30"
                  >
                    {copied ? "Copied ✓ now paste in Facebook" : "Copy 复制"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
