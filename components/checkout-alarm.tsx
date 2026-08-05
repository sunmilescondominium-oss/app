"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** Two short attention beeps (WebAudio, no asset). */
function beep(ctx: AudioContext | null) {
  try {
    const c = ctx ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [0, 0.3].forEach((t) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      const t0 = c.currentTime + t;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g).connect(c.destination);
      o.start(t0);
      o.stop(t0 + 0.24);
    });
  } catch { /* audio blocked — ignore */ }
}

/**
 * Watches the count of pending guest checkout requests. Beeps when a NEW one
 * arrives, and auto-refreshes the board so the request appears without a manual
 * reload. Renders a pulsing banner while any are pending.
 */
export function CheckoutAlarm({ count, label = "guest check-out requested" }: { count: number; label?: string }) {
  const router = useRouter();
  const prev = useRef(count);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // A click anywhere unlocks/keeps audio alive (browser autoplay policy).
    const ensure = () => {
      try {
        if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        void ctxRef.current.resume?.();
      } catch { /* ignore */ }
    };
    window.addEventListener("click", ensure);
    const id = window.setInterval(() => router.refresh(), 20_000);
    return () => { window.removeEventListener("click", ensure); clearInterval(id); };
  }, [router]);

  useEffect(() => {
    if (count > prev.current) beep(ctxRef.current);
    prev.current = count;
  }, [count]);

  if (count === 0) return null;
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border-2 border-rose-400 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 animate-pulse">
      🔔 {count} {label}
    </div>
  );
}
