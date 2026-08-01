"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clockIn, clockOut } from "@/app/(app)/attendance/actions";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" });
}

export function AttendanceClock({ clockedIn, since }: { clockedIn: boolean; since: string | null }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ready, setReady] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch {
      setCamError("Camera unavailable or permission denied. You can still clock in without a photo.");
      setReady(false);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    setCaptured(canvas.toDataURL("image/jpeg", 0.7));
    canvas.toBlob((b) => setBlob(b), "image/jpeg", 0.7);
  }

  function retake() {
    setCaptured(null);
    setBlob(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    if (blob) fd.append("photo", blob, "attendance.jpg");
    const res = clockedIn ? await clockOut(undefined, fd) : await clockIn(undefined, fd);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    stopCamera();
    retake();
    router.refresh();
  }

  const canSubmit = (Boolean(blob) || Boolean(camError)) && !busy;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">{clockedIn ? "You are clocked in" : "You are clocked out"}</p>
          {clockedIn && <p className="text-xs text-slate-500">Since {fmt(since)}</p>}
        </div>
        <span className={`h-3 w-3 rounded-full ${clockedIn ? "bg-emerald-500" : "bg-slate-300"}`} />
      </div>

      <div className="relative mb-3 aspect-[4/3] w-full max-w-sm overflow-hidden rounded-xl bg-slate-900">
        {/* live preview (hidden once a frame is captured) */}
        <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${captured ? "hidden" : "block"}`} />
        {captured && <img src={captured} alt="Captured" className="h-full w-full object-cover" />}
        {!ready && !captured && !camError && (
          <div className="absolute inset-0 grid place-items-center text-xs text-slate-300">Starting camera…</div>
        )}
        {camError && !captured && (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-slate-300">{camError}</div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex flex-wrap gap-2">
        {!captured && ready && (
          <button type="button" onClick={capture} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900">
            Take photo
          </button>
        )}
        {captured && (
          <button type="button" onClick={retake} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Retake
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={`rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
            clockedIn ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {busy ? "Saving…" : clockedIn ? "Clock Out" : "Clock In"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      {!blob && !camError && <p className="mt-2 text-xs text-slate-400">Take a photo to enable clock {clockedIn ? "out" : "in"}.</p>}
    </div>
  );
}
