"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Live short-clip video capture via MediaRecorder. Records straight from the
 * camera stream (no file picker → nothing to recycle) and auto-stops at maxSec.
 * The capture start time is reported for the audit trail.
 */
export function VideoCapture({
  onCapture,
  maxSec = 20,
  busy = false,
}: {
  onCapture: (file: File, capturedAt: string) => Promise<void> | void;
  maxSec?: number;
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
      streamRef.current = stream;
      setOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Camera/mic not available or permission denied. A live recording is required.");
    }
  }

  function close() {
    cleanup();
    setOpen(false);
    setRecording(false);
    setSecs(0);
  }

  function beginRecord() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    startedRef.current = new Date().toISOString();
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime });
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = onStop;
    recRef.current = rec;
    rec.start();
    setRecording(true);
    setSecs(0);
    timerRef.current = setInterval(() => {
      setSecs((s) => {
        if (s + 1 >= maxSec) stopRecord();
        return s + 1;
      });
    }, 1000);
  }

  function stopRecord() {
    if (timerRef.current) clearInterval(timerRef.current);
    recRef.current?.state === "recording" && recRef.current.stop();
    setRecording(false);
  }

  async function onStop() {
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    if (!blob.size) return;
    const at = startedRef.current || new Date().toISOString();
    const file = new File([blob], `clip_${at.replace(/[:.]/g, "-")}.webm`, { type: "video/webm", lastModified: Date.now() });
    setWorking(true);
    try {
      await onCapture(file, at);
      close();
    } finally {
      setWorking(false);
    }
  }

  if (!open) {
    return (
      <div>
        <button type="button" onClick={start} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60">
          🎥 Record video
        </button>
        {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-300 bg-black/90 p-2">
      <video ref={videoRef} playsInline muted className="mx-auto max-h-72 w-full rounded-lg object-contain" />
      <div className="mt-2 flex items-center justify-center gap-2">
        {!recording ? (
          <button type="button" onClick={beginRecord} disabled={working} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">● Start</button>
        ) : (
          <button type="button" onClick={stopRecord} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-300">■ Stop ({maxSec - secs}s)</button>
        )}
        <button type="button" onClick={close} disabled={working || recording} className="rounded-lg border border-stone-400 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60">Cancel</button>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-stone-300">{working ? "Saving…" : `Live recording only · up to ${maxSec}s`}</p>
    </div>
  );
}
