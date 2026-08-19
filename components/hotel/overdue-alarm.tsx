"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

export interface AlarmStay {
  id: string;
  unit_number: string;
  guest_label: string;
  check_in_at: string;
  planned_hours: number;
}

interface Flagged {
  stay: AlarmStay;
  remMs: number;
}

const WARN_20_MS = 20 * 60 * 1000;  // 20-minute heads-up
const WARN_15_MS = 15 * 60 * 1000;  // 15-minute reminder
const WARN_5_MS  =  5 * 60 * 1000;  // 5-minute urgent warning
const SNOOZE_MS  =  3 * 60 * 1000;  // bell press snoozes for 3 min
const BEEP_GAP   = 2_000;           // repeat alarm beep every 2s while ringing

// ── audio helpers (WebAudio, no asset files) ────────────────────────────────

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

/** Single soft chime at 528 Hz — 20-minute early notice. */
function playChime20(ctx: AudioContext): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.value = 528;
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + 0.6);
}

/** Double beep at 594 Hz — 15-minute reminder. */
function playChime15(ctx: AudioContext): void {
  [0, 0.45].forEach((delay) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 594;
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + 0.42);
  });
}

/** Soft 2-beep at 660 Hz — 5-minute "heads up" signal. */
function playWarning(ctx: AudioContext): void {
  [0, 0.5].forEach((delay) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 660;
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.46);
  });
}

/** 3 urgent alternating square-wave blips — overdue alarm repeating cycle. */
function playAlarm(ctx: AudioContext): void {
  [0, 0.32, 0.64].forEach((delay, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = i % 2 === 0 ? 880 : 1100;
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.26);
  });
}

// ── formatting ───────────────────────────────────────────────────────────────

function fmt(ms: number): string {
  const s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
}

// ── component ────────────────────────────────────────────────────────────────

export function OverdueAlarm({ stays }: { stays: AlarmStay[] }) {
  const ctxRef        = useRef<AudioContext | null>(null);
  const snoozeRef     = useRef(0);
  const lastBeepRef   = useRef(0);
  const warned20Ref   = useRef(new Set<string>());
  const warned15Ref   = useRef(new Set<string>());
  const warned5Ref    = useRef(new Set<string>());
  const pushedRef     = useRef(new Set<string>());

  // `now` drives re-renders every second; `snoozedUntil` drives the countdown text
  const [now, setNow]               = useState(Date.now);
  const [snoozedUntil, setSnoozedUntil] = useState(0);

  // Unlock AudioContext on any user interaction (browser autoplay policy)
  useEffect(() => {
    const unlock = () => { getCtx(ctxRef); };
    window.addEventListener("click", unlock);
    return () => window.removeEventListener("click", unlock);
  }, []);

  // Main tick — updates clock + fires audio
  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);

      const ctx = ctxRef.current;
      const snoozed = n < snoozeRef.current;

      for (const s of stays) {
        const remMs = new Date(s.check_in_at).getTime() + s.planned_hours * 3_600_000 - n;
        if (remMs <= 0) continue; // overdue handled below

        if (!snoozed && ctx) {
          if (remMs <= WARN_20_MS && !warned20Ref.current.has(s.id)) {
            playChime20(ctx);
            warned20Ref.current.add(s.id);
          }
          if (remMs <= WARN_15_MS && !warned15Ref.current.has(s.id)) {
            playChime15(ctx);
            warned15Ref.current.add(s.id);
          }
          if (remMs <= WARN_5_MS && !warned5Ref.current.has(s.id)) {
            playWarning(ctx);
            warned5Ref.current.add(s.id);
          }
        }
      }

      let hasOverdue = false;
      for (const s of stays) {
        const remMs = new Date(s.check_in_at).getTime() + s.planned_hours * 3_600_000 - n;
        if (remMs >= 0) continue;
        hasOverdue = true;
        // Push notification: fire once per stay when it first crosses into overdue
        if (!pushedRef.current.has(s.id)) {
          pushedRef.current.add(s.id);
          const overByMin = Math.floor(-remMs / 60_000);
          fetch("/api/push/alarm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: "hotel_overdue", id: s.id, unit: s.unit_number, overByMin }),
          }).catch(() => {});
        }
      }

      // Overdue alarm: beep every BEEP_GAP ms while ringing and not snoozed
      if (ctx && hasOverdue && !snoozed && n - lastBeepRef.current >= BEEP_GAP) {
        playAlarm(ctx);
        lastBeepRef.current = n;
      }
    }, 1_000);

    return () => clearInterval(id);
  }, [stays]);

  const dismiss = useCallback(() => {
    const until = Date.now() + SNOOZE_MS;
    snoozeRef.current = until;
    setSnoozedUntil(until);
    lastBeepRef.current = 0; // reset so alarm starts fresh after snooze
  }, []);

  // Compute display state from current `now`
  const overdues:  Flagged[] = [];
  const warn5:     Flagged[] = [];
  const warn15:    Flagged[] = [];
  const warn20:    Flagged[] = [];
  for (const s of stays) {
    const remMs = new Date(s.check_in_at).getTime() + s.planned_hours * 3_600_000 - now;
    if (remMs < 0)               overdues.push({ stay: s, remMs });
    else if (remMs <= WARN_5_MS)  warn5.push({ stay: s, remMs });
    else if (remMs <= WARN_15_MS) warn15.push({ stay: s, remMs });
    else if (remMs <= WARN_20_MS) warn20.push({ stay: s, remMs });
  }

  const snoozed     = now < snoozedUntil;
  const snoozeRemMs = Math.max(0, snoozedUntil - now);
  const isRinging   = overdues.length > 0 && !snoozed;

  if (overdues.length === 0 && warn5.length === 0 && warn15.length === 0 && warn20.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {/* ── Overdue alarm banner ── */}
      {overdues.length > 0 && (
        <div
          className={`rounded-xl border-2 p-3 transition-colors ${
            isRinging
              ? "border-red-500 bg-red-50 animate-pulse"
              : "border-stone-300 bg-stone-50"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl leading-none" aria-hidden>
                {isRinging ? "🔔" : "🔕"}
              </span>
              <div>
                <p className={`text-sm font-bold ${isRinging ? "text-red-700" : "text-stone-600"}`}>
                  {overdues.length} room{overdues.length > 1 ? "s" : ""} overdue
                  {snoozed && (
                    <span className="ml-2 font-normal text-stone-500">
                      · alarm resumes in {fmt(snoozeRemMs)}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-stone-500">
                  {isRinging
                    ? "Press the bell to snooze alarm for 3 minutes"
                    : "Alarm snoozed — rooms still require check-out"}
                </p>
              </div>
            </div>

            {/* Bell / snooze button — only visible while ringing */}
            {isRinging && (
              <button
                type="button"
                onClick={dismiss}
                className="shrink-0 rounded-xl border-2 border-red-500 bg-white px-3 py-2 text-sm font-bold text-red-700
                           shadow-sm hover:bg-red-100 active:scale-95 transition-transform select-none"
                aria-label="Snooze overdue alarm for 3 minutes"
              >
                🔔 Snooze
              </button>
            )}
          </div>

          {/* Per-room overdue rows */}
          <div className="mt-2 space-y-1">
            {overdues.map(({ stay, remMs }) => (
              <div
                key={stay.id}
                className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-1.5 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-stone-900">Room {stay.unit_number}</span>
                  <span className="ml-2 truncate text-stone-500">{stay.guest_label}</span>
                </div>
                <div className="ml-2 flex shrink-0 items-center gap-2">
                  <span className="font-mono text-xs font-bold text-red-700">
                    +{fmt(remMs)}
                  </span>
                  <Link
                    href={`/hotel/${stay.id}`}
                    className="rounded-md bg-stone-800 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-stone-700"
                  >
                    Folio →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5-minute urgent warning ── */}
      {warn5.length > 0 && (
        <WarnBanner
          rooms={warn5}
          label={`${warn5.length} room${warn5.length > 1 ? "s" : ""} checking out within 5 minutes`}
          borderColor="border-orange-500"
          bgColor="bg-orange-50"
          textColor="text-orange-800"
          icon="⚠"
        />
      )}

      {/* ── 15-minute reminder ── */}
      {warn15.length > 0 && (
        <WarnBanner
          rooms={warn15}
          label={`${warn15.length} room${warn15.length > 1 ? "s" : ""} checking out within 15 minutes`}
          borderColor="border-amber-400"
          bgColor="bg-amber-50"
          textColor="text-amber-800"
          icon="🕐"
        />
      )}

      {/* ── 20-minute early notice ── */}
      {warn20.length > 0 && (
        <WarnBanner
          rooms={warn20}
          label={`${warn20.length} room${warn20.length > 1 ? "s" : ""} checking out within 20 minutes`}
          borderColor="border-yellow-300"
          bgColor="bg-yellow-50"
          textColor="text-yellow-800"
          icon="🔔"
        />
      )}
    </div>
  );
}

function WarnBanner({
  rooms, label, borderColor, bgColor, textColor, icon,
}: {
  rooms: Flagged[];
  label: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  icon: string;
}) {
  return (
    <div className={`rounded-xl border-2 ${borderColor} ${bgColor} p-3`}>
      <div className="flex items-center gap-2">
        <span className="text-base leading-none" aria-hidden>{icon}</span>
        <p className={`text-sm font-semibold ${textColor}`}>{label}</p>
      </div>
      <div className="mt-2 space-y-1">
        {rooms.map(({ stay, remMs }) => (
          <div key={stay.id} className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-1.5 text-sm">
            <div className="min-w-0">
              <span className="font-semibold text-stone-900">Room {stay.unit_number}</span>
              <span className="ml-2 truncate text-stone-500">{stay.guest_label}</span>
            </div>
            <div className="ml-2 flex shrink-0 items-center gap-2">
              <span className={`font-mono text-xs font-bold ${remMs < 60_000 ? "text-red-600" : textColor}`}>
                {fmt(remMs)} left
              </span>
              <Link href={`/hotel/${stay.id}`} className="rounded-md bg-stone-800 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-stone-700">
                Folio →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
