"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APP_BRAND_SHORT } from "@/lib/config";

/**
 * Live in-app camera capture. Because the frame is grabbed from a getUserMedia
 * stream (never a file picker), a previously-saved / gallery photo cannot be
 * recycled. A timestamp (+ optional label) is burned into the image, and the
 * exact capture time is reported to the caller for the audit trail.
 */
export function CameraCapture({
  onCapture,
  label,
  facingMode = "environment",
  buttonText = "Take photo",
  busy = false,
}: {
  onCapture: (file: File, capturedAt: string) => Promise<void> | void;
  label?: string;
  facingMode?: "environment" | "user";
  buttonText?: string;
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stop(), [stop]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
      streamRef.current = stream;
      setOpen(true);
      // videoRef is rendered once open is true; attach on next tick.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Camera not available or permission denied. A live photo is required — please allow camera access on a device with a camera.");
    }
  }

  function close() {
    stop();
    setOpen(false);
  }

  async function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);

    // Burn a timestamp watermark into the image.
    const capturedAt = new Date();
    const stamp = capturedAt.toLocaleString("en-PH", {
      timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const pad = Math.round(w * 0.015);
    const fs = Math.max(14, Math.round(w * 0.028));
    const barH = fs * (label ? 2.9 : 1.9) + pad;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, h - barH, w, barH);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";
    ctx.font = `600 ${fs}px system-ui, sans-serif`;
    ctx.fillText(`🕒 ${stamp}`, pad, h - barH + pad * 0.6);
    if (label) {
      ctx.font = `500 ${Math.round(fs * 0.85)}px system-ui, sans-serif`;
      ctx.fillText(label, pad, h - barH + pad * 0.6 + fs * 1.15);
    }
    ctx.font = `500 ${Math.round(fs * 0.7)}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(`${APP_BRAND_SHORT} · live capture`, w - pad, h - fs * 0.9 - pad * 0.5);
    ctx.textAlign = "left";

    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.75));
    if (!blob) return;
    const iso = capturedAt.toISOString();
    const file = new File([blob], `capture_${iso.replace(/[:.]/g, "-")}.jpg`, { type: "image/jpeg", lastModified: capturedAt.getTime() });

    setWorking(true);
    try {
      await onCapture(file, iso);
      close();
    } finally {
      setWorking(false);
    }
  }

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
        >
          📷 {buttonText}
        </button>
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-300 bg-black/90 p-2">
      <video ref={videoRef} playsInline muted className="mx-auto max-h-72 w-full rounded-lg object-contain" />
      <canvas ref={canvasRef} className="hidden" />
      <div className="mt-2 flex items-center justify-center gap-2">
        <button type="button" onClick={capture} disabled={working || busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
          {working || busy ? "Saving…" : "📸 Capture"}
        </button>
        <button type="button" onClick={close} disabled={working} className="rounded-lg border border-stone-400 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
          Cancel
        </button>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-stone-300">Live camera only — the photo is stamped with the current date &amp; time.</p>
    </div>
  );
}
