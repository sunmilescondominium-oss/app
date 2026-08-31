"use client";

import { useState, useEffect, useCallback } from "react";
import { startBagging } from "./actions";

function isBaggingWindow(startsAt: string | null, endsAt: string | null): boolean {
  if (!startsAt || !endsAt) return false;
  const diffMs = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return diffMs <= 25 * 60 * 1000;
}

function secondsLeft(endsAt: string | null): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
}

export function StartBaggingButton({
  sessionId,
  collectionStartsAt,
  collectionEndsAt,
  isOnDuty,
}: {
  sessionId: string;
  collectionStartsAt: string | null;
  collectionEndsAt: string | null;
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!triggered || !endsAt) return;
    const tick = () => setSecs(secondsLeft(endsAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [triggered, endsAt]);

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

  if (triggered) {
    const cutoffLabel = endsAt
      ? new Date(endsAt).toLocaleTimeString("en-PH", {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          minute: "2-digit",
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
            <div>
              <p className="text-sm font-semibold text-amber-900">Counting &amp; Bagging in Progress</p>
              <p className="mt-0.5 text-xs text-amber-700">
                New check-in payments received after <strong>{cutoffLabel}</strong> will be collected by the next cashier.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4">
        <p className="text-sm font-semibold text-emerald-900">✓ Bagging window closed</p>
        <p className="mt-0.5 text-xs text-emerald-700">
          All new check-in payments are attributed to the next cashier. You may now close your shift.
        </p>
      </div>
    );
  }

  if (!isOnDuty) return null;

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
