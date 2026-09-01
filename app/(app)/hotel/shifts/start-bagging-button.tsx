"use client";

import { useState, useEffect, useCallback } from "react";
import { startBagging, bagCollection } from "./actions";

const PESO_DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 1] as const;

function isBaggingWindow(startsAt: string | null, endsAt: string | null): boolean {
  if (!startsAt || !endsAt) return false;
  const diffMs = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return diffMs <= 25 * 60 * 1000;
}

function secondsLeft(endsAt: string | null): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
}

function secondsUntil25MinAlarm(openedAt: string): number {
  const alarmAt = new Date(openedAt).getTime() + (12 * 60 - 25) * 60 * 1000;
  return Math.max(0, Math.floor((alarmAt - Date.now()) / 1000));
}

function DenomForm({
  sessionId,
  initial,
  onSaved,
}: {
  sessionId: string;
  initial: Record<string, number> | null;
  onSaved: (counts: Record<string, number>) => void;
}) {
  const [counts, setCounts] = useState<Record<number, number>>(() => {
    const base: Record<number, number> = {};
    for (const d of PESO_DENOMS) base[d] = initial?.[String(d)] ?? 0;
    return base;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);
  const [saved, setSaved] = useState(!!initial && Object.values(initial).some(v => v > 0));

  const total = PESO_DENOMS.reduce((s, d) => s + d * (counts[d] ?? 0), 0);

  const handleSave = useCallback(async () => {
    setBusy(true); setErr(null);
    const payload: Record<string, number> = {};
    for (const d of PESO_DENOMS) payload[String(d)] = counts[d] ?? 0;
    const res = await bagCollection(sessionId, payload);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setSaved(true);
    onSaved(payload);
  }, [sessionId, counts, onSaved]);

  return (
    <div className="mt-4 border-t border-emerald-200 pt-4">
      <p className="mb-2 text-xs font-semibold text-stone-700">
        {saved ? "✓ Denomination counts saved" : "Enter your cash denomination counts"}
      </p>
      <div className="space-y-1.5">
        {PESO_DENOMS.map((d) => (
          <div key={d} className="flex items-center gap-3">
            <span className="w-16 text-right text-xs font-medium text-stone-600">₱{d.toLocaleString()}</span>
            <input
              type="number"
              min={0}
              value={counts[d] ?? 0}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setCounts((c) => ({ ...c, [d]: Number.isFinite(v) && v >= 0 ? v : 0 }));
                setSaved(false);
              }}
              className="w-20 rounded border border-stone-300 px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-amber-500"
            />
            <span className="text-xs text-stone-400">
              = ₱{((counts[d] ?? 0) * d).toLocaleString("en-PH")}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-bold text-stone-800">
          Total: ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : saved ? "Update count" : "Save denomination count"}
        </button>
      </div>
      {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
    </div>
  );
}

export function StartBaggingButton({
  sessionId,
  openedAt,
  collectionStartsAt,
  collectionEndsAt,
  bagDenominations,
  isOnDuty,
}: {
  sessionId: string;
  openedAt: string;
  collectionStartsAt: string | null;
  collectionEndsAt: string | null;
  bagDenominations: Record<string, number> | null;
  isOnDuty: boolean;
}) {
  const [triggered, setTriggered] = useState(() =>
    isBaggingWindow(collectionStartsAt, collectionEndsAt),
  );
  const [endsAt, setEndsAt] = useState<string | null>(
    () => (isBaggingWindow(collectionStartsAt, collectionEndsAt) ? collectionEndsAt : null),
  );
  const [secs, setSecs] = useState(() =>
    isBaggingWindow(collectionStartsAt, collectionEndsAt)
      ? secondsLeft(collectionEndsAt)
      : 0,
  );
  const [alarmSecs, setAlarmSecs] = useState(() => secondsUntil25MinAlarm(openedAt));
  const [alarmFired, setAlarmFired] = useState(() => secondsUntil25MinAlarm(openedAt) === 0);
  const [savedCounts, setSavedCounts] = useState<Record<string, number> | null>(bagDenominations);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Countdown timer for the bagging window
  useEffect(() => {
    if (!triggered || !endsAt) return;
    const tick = () => setSecs(secondsLeft(endsAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [triggered, endsAt]);

  // 25-min alarm countdown (runs until the cashier starts bagging or alarm fires)
  useEffect(() => {
    if (triggered || alarmFired) return;
    const tick = () => {
      const s = secondsUntil25MinAlarm(openedAt);
      setAlarmSecs(s);
      if (s === 0) setAlarmFired(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [triggered, alarmFired, openedAt]);

  const handleClick = useCallback(async () => {
    setPending(true);
    setError(null);
    const res = await startBagging(sessionId);
    setPending(false);
    if (!res.ok) { setError(res.error); return; }
    const newEndsAt = res.endsAt!;
    setEndsAt(newEndsAt);
    setSecs(secondsLeft(newEndsAt));
    setTriggered(true);
  }, [sessionId]);

  const mins = Math.floor(secs / 60);
  const s    = secs % 60;

  // ── Bagging window is active ───────────────────────────────────────────────
  if (triggered) {
    const cutoffLabel = endsAt
      ? new Date(endsAt).toLocaleTimeString("en-PH", {
          timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit",
        })
      : "—";

    if (secs > 0) {
      return (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full bg-amber-500 font-mono font-bold text-white text-sm leading-tight">
              <span>{String(mins).padStart(2, "0")}</span>
              <span className="text-[10px] opacity-80">:{String(s).padStart(2, "0")}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">Counting &amp; Bagging in Progress</p>
              <p className="mt-0.5 text-xs text-amber-700">
                New check-in payments received after <strong>{cutoffLabel}</strong> will be collected by the next cashier.
              </p>
            </div>
          </div>
          {isOnDuty && (
            <DenomForm
              sessionId={sessionId}
              initial={savedCounts}
              onSaved={setSavedCounts}
            />
          )}
        </div>
      );
    }

    // Window expired — show denomination form so cashier can still update counts
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-900">✓ Bagging window closed</p>
        <p className="mt-0.5 text-xs text-emerald-700">
          All new check-in payments are attributed to the next cashier. You may now close your shift.
        </p>
        {isOnDuty && (
          <DenomForm
            sessionId={sessionId}
            initial={savedCounts}
            onSaved={setSavedCounts}
          />
        )}
      </div>
    );
  }

  if (!isOnDuty) return null;

  // ── 25-min alarm — shift ending soon ──────────────────────────────────────
  if (alarmFired) {
    const alarmMins = Math.floor(alarmSecs / 60);
    const alarmS    = alarmSecs % 60;
    void alarmMins; void alarmS;
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-xl">⏰</span>
            <div>
              <p className="text-sm font-semibold text-rose-900">Your shift ends in 25 minutes — start counting now!</p>
              <p className="mt-0.5 text-xs text-rose-700">
                Click &quot;Start Counting &amp; Bagging&quot; below to begin the 20-minute collection cutoff window.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}
          <button
            onClick={handleClick}
            disabled={pending}
            className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {pending ? "Starting…" : "Start Counting & Bagging"}
          </button>
        </div>
      </div>
    );
  }

  // ── Default: pre-alarm state ───────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="mb-1 text-sm font-semibold text-stone-800">Start Counting &amp; Bagging</p>
      <p className="mb-3 text-xs text-stone-500">
        Click when you are ready to count and bag your collections. For the next <strong>20 minutes</strong>,
        new check-in payments will be collected by the incoming cashier. After the window, close your shift.
      </p>
      {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}
      <button
        onClick={handleClick}
        disabled={pending}
        className="w-full rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {pending ? "Starting…" : "Start Counting & Bagging"}
      </button>
    </div>
  );
}
