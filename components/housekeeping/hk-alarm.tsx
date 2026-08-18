"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { HousekeepingTask } from "@/lib/housekeeping/types";

// ── constants ─────────────────────────────────────────────────────────────────

const WARN_MS   = 5 * 60 * 1000;   // 5-min warning zone
const SNOOZE_MS = 3 * 60 * 1000;   // bell press snoozes for 3 min
const BEEP_GAP  = 2_000;            // repeat alarm cycle every 2 s
const REFRESH_MS = 20_000;          // board refresh — picks up task-done from another device

// ── audio helpers (WebAudio, no asset files needed) ──────────────────────────

type WinWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

function getCtx(ref: React.MutableRefObject<AudioContext | null>): AudioContext | null {
  try {
    if (!ref.current) {
      const Ctor = window.AudioContext || (window as WinWithWebkit).webkitAudioContext;
      if (!Ctor) return null;
      ref.current = new Ctor();
    }
    void ref.current.resume?.();
    return ref.current;
  } catch {
    return null;
  }
}

/** Soft 2-beep at 700 Hz — "heads-up" 5-minute warning. */
function playWarning(ctx: AudioContext): void {
  [0, 0.55].forEach((delay) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 700;
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.48);
  });
}

/** 4 urgent triangle-wave pulses at 960/1200 Hz — cleaning SLA alarm. */
function playAlarm(ctx: AudioContext): void {
  [0, 0.28, 0.56, 0.84].forEach((delay, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = i % 2 === 0 ? 960 : 1200;
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.24);
  });
}

// ── SLA deadline types ────────────────────────────────────────────────────────

interface Deadline {
  task: HousekeepingTask;
  deadlineMs: number;
  kind: "start" | "complete";
  remMs: number;      // positive = time remaining, negative = overdue by
}

function computeDeadlines(tasks: HousekeepingTask[], now: number): {
  warnings: Deadline[];
  overdues: Deadline[];
} {
  const warnings: Deadline[] = [];
  const overdues: Deadline[] = [];

  for (const task of tasks) {
    if (task.status === "done") continue;

    let deadlineMs: number | null = null;
    let kind: "start" | "complete" = "start";

    if (task.status === "pending" && task.start_by) {
      deadlineMs = new Date(task.start_by).getTime();
      kind = "start";
    } else if (task.status === "in_progress" && task.started_at && task.cleaning_minutes) {
      deadlineMs = new Date(task.started_at).getTime() + task.cleaning_minutes * 60_000;
      kind = "complete";
    }

    if (deadlineMs == null) continue;

    const remMs = deadlineMs - now;
    const entry: Deadline = { task, deadlineMs, kind, remMs };

    if (remMs < 0)             overdues.push(entry);
    else if (remMs <= WARN_MS) warnings.push(entry);
  }

  return { warnings, overdues };
}

// ── formatting ────────────────────────────────────────────────────────────────

function fmt(ms: number): string {
  const s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
}

// ── component ─────────────────────────────────────────────────────────────────

export function HKAlarm({ tasks }: { tasks: HousekeepingTask[] }) {
  const router = useRouter();

  const ctxRef        = useRef<AudioContext | null>(null);
  const snoozeRef     = useRef(0);
  const lastBeepRef   = useRef(0);
  const warnedRef     = useRef(new Set<string>()); // "taskId:kind" already warned

  const [now, setNow]               = useState(Date.now);
  const [snoozedUntil, setSnoozedUntil] = useState(0);

  // Unlock AudioContext on any user interaction
  useEffect(() => {
    const unlock = () => { getCtx(ctxRef); };
    window.addEventListener("click", unlock);
    return () => window.removeEventListener("click", unlock);
  }, []);

  // Main tick — 1 s cadence: update clock, fire audio, refresh board periodically
  useEffect(() => {
    let lastRefresh = Date.now();

    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);

      // Periodic board refresh so completed tasks disappear without manual reload
      if (n - lastRefresh >= REFRESH_MS) {
        router.refresh();
        lastRefresh = n;
      }

      const ctx = ctxRef.current;
      const snoozed = n < snoozeRef.current;
      const { warnings, overdues } = computeDeadlines(tasks, n);

      // 5-minute warning — play once per task:kind entry
      if (ctx && !snoozed) {
        for (const { task, kind } of warnings) {
          const key = `${task.id}:${kind}`;
          if (!warnedRef.current.has(key)) {
            playWarning(ctx);
            warnedRef.current.add(key);
          }
        }
      }

      // Overdue alarm — repeat every BEEP_GAP while ringing and not snoozed
      if (ctx && overdues.length > 0 && !snoozed && n - lastBeepRef.current >= BEEP_GAP) {
        playAlarm(ctx);
        lastBeepRef.current = n;
      }
    }, 1_000);

    return () => clearInterval(id);
  }, [tasks, router]);

  const dismiss = useCallback(() => {
    const until = Date.now() + SNOOZE_MS;
    snoozeRef.current = until;
    setSnoozedUntil(until);
    lastBeepRef.current = 0;
  }, []);

  // Display state
  const { warnings, overdues } = computeDeadlines(tasks, now);
  const snoozed     = now < snoozedUntil;
  const isRinging   = overdues.length > 0 && !snoozed;
  const snoozeRemMs = Math.max(0, snoozedUntil - now);

  if (overdues.length === 0 && warnings.length === 0) return null;

  const kindLabel = (kind: "start" | "complete") =>
    kind === "start" ? "must start cleaning" : "must finish cleaning";

  return (
    <div className="mb-4 space-y-2">
      {/* ── Overdue alarm ── */}
      {overdues.length > 0 && (
        <div
          className={`rounded-xl border-2 p-3 transition-colors ${
            isRinging
              ? "border-rose-500 bg-rose-50 animate-pulse"
              : "border-stone-300 bg-stone-50"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl leading-none" aria-hidden>
                {isRinging ? "🔔" : "🔕"}
              </span>
              <div>
                <p className={`text-sm font-bold ${isRinging ? "text-rose-700" : "text-stone-600"}`}>
                  {overdues.length} room{overdues.length > 1 ? "s" : ""} overdue for cleaning
                  {snoozed && (
                    <span className="ml-2 font-normal text-stone-500">
                      · alarm resumes in {fmt(snoozeRemMs)}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-stone-500">
                  {isRinging
                    ? "Press the bell to snooze alarm for 3 minutes"
                    : "Alarm snoozed — rooms still awaiting cleaning"}
                </p>
              </div>
            </div>

            {isRinging && (
              <button
                type="button"
                onClick={dismiss}
                className="shrink-0 rounded-xl border-2 border-rose-500 bg-white px-3 py-2 text-sm font-bold
                           text-rose-700 shadow-sm hover:bg-rose-100 active:scale-95 transition-transform select-none"
                aria-label="Snooze cleaning alarm for 3 minutes"
              >
                🔔 Snooze
              </button>
            )}
          </div>

          <div className="mt-2 space-y-1">
            {overdues.map(({ task, remMs, kind }) => (
              <div
                key={`${task.id}:${kind}`}
                className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-1.5 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-stone-900">Room {task.unit_number ?? "—"}</span>
                  <span className="ml-2 text-xs text-stone-400">{kindLabel(kind)}</span>
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-2">
                  <span className="font-mono text-xs font-bold text-rose-700">+{fmt(remMs)}</span>
                  <Link
                    href={`/housekeeping/${task.id}`}
                    className="rounded-md bg-stone-800 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-stone-700"
                  >
                    Task →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5-minute warning ── */}
      {warnings.length > 0 && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none" aria-hidden>⚠</span>
            <p className="text-sm font-semibold text-amber-800">
              {warnings.length} cleaning deadline{warnings.length > 1 ? "s" : ""} within 5 minutes
            </p>
          </div>
          <div className="mt-2 space-y-1">
            {warnings.map(({ task, remMs, kind }) => (
              <div
                key={`${task.id}:${kind}`}
                className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-1.5 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-stone-900">Room {task.unit_number ?? "—"}</span>
                  <span className="ml-2 text-xs text-stone-400">{kindLabel(kind)}</span>
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-2">
                  <span
                    className={`font-mono text-xs font-bold ${
                      remMs < 60_000 ? "text-rose-600" : "text-amber-700"
                    }`}
                  >
                    {fmt(remMs)} left
                  </span>
                  <Link
                    href={`/housekeeping/${task.id}`}
                    className="rounded-md bg-stone-800 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-stone-700"
                  >
                    Task →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
