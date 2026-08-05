"use client";

import { useEffect, useRef, useState } from "react";

type Kind = "on_time" | "late";

/** Play a short chime for on-time, or a gentle "womp" for late (WebAudio, no assets). */
function playChime(kind: Kind) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = kind === "on_time" ? [523.25, 659.25, 783.99, 1046.5] : [392, 261.63];
    const type: OscillatorType = kind === "on_time" ? "triangle" : "sawtooth";
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = f;
      const t0 = ctx.currentTime + i * (kind === "on_time" ? 0.12 : 0.22);
      const dur = kind === "on_time" ? 0.14 : 0.28;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch { /* audio not allowed — ignore */ }
}

type P = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; color: string; size: number };

/** Full-screen particle burst: colourful confetti for on-time, grey drizzle for late. */
function runParticles(canvas: HTMLCanvasElement, kind: Kind): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const dpr = window.devicePixelRatio || 1;
  const W = (canvas.width = window.innerWidth * dpr);
  const H = (canvas.height = window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;

  const colors = kind === "on_time"
    ? ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#a855f7", "#ec4899", "#eab308"]
    : ["#94a3b8", "#64748b", "#cbd5e1"];
  const count = kind === "on_time" ? 160 : 90;
  const parts: P[] = Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: kind === "on_time" ? -Math.random() * H * 0.4 : -Math.random() * H * 0.2,
    vx: (Math.random() - 0.5) * (kind === "on_time" ? 6 : 2) * dpr,
    vy: (kind === "on_time" ? 2 + Math.random() * 4 : 6 + Math.random() * 6) * dpr,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: (kind === "on_time" ? 6 + Math.random() * 6 : 3 + Math.random() * 3) * dpr,
  }));

  let raf = 0;
  const start = performance.now();
  const gravity = 0.15 * dpr;
  function frame(t: number) {
    ctx!.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.fillStyle = p.color;
      if (kind === "on_time") ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
      else { ctx!.beginPath(); ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx!.fill(); }
      ctx!.restore();
    }
    if (t - start < 2200) raf = requestAnimationFrame(frame);
    else ctx!.clearRect(0, 0, W, H);
  }
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

// Minimum time the message must stay on screen; hard cap so it never lingers.
const MIN_MS = 5000;
const MAX_MS = 6500;

export function Celebrate({ kind, onDone }: { kind: Kind; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canClose, setCanClose] = useState(false);

  // Keep the latest onDone in a ref so parent re-renders (e.g. the camera
  // countdown ticking every second) never restart the banner's timers.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    playChime(kind);
    const stop = canvasRef.current ? runParticles(canvasRef.current, kind) : () => {};
    const openBtn = setTimeout(() => setCanClose(true), MIN_MS);       // enable close after 5s
    const auto = setTimeout(() => onDoneRef.current(), MAX_MS);        // auto-dismiss so it never lingers
    return () => { stop(); clearTimeout(openBtn); clearTimeout(auto); };
  }, [kind]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className={kind === "late" ? "kiosk-shake" : ""}>
        <div
          className={`rounded-2xl px-8 py-5 text-center text-3xl font-extrabold shadow-xl sm:text-4xl ${
            kind === "on_time" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}
        >
          {kind === "on_time" ? "🎉 On time! 🎉" : "⏰ You're late!"}
          <div className="mt-1 text-base font-medium opacity-90">
            {kind === "on_time" ? "Have a great shift!" : "Please try to be earlier tomorrow."}
          </div>
          <button
            type="button"
            onClick={onDone}
            disabled={!canClose}
            className={`pointer-events-auto mt-3 rounded-lg bg-white/20 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-white/30 ${canClose ? "opacity-100" : "cursor-default opacity-40"}`}
          >
            {canClose ? "Close" : "Please wait…"}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes kioskShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-10px) rotate(-2deg)} 40%{transform:translateX(10px) rotate(2deg)} 60%{transform:translateX(-8px) rotate(-1deg)} 80%{transform:translateX(8px) rotate(1deg)} }
        .kiosk-shake { animation: kioskShake 0.5s ease-in-out 0s 3; }
      `}</style>
    </div>
  );
}
