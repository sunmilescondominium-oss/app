"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { portalCheckIn, portalCheckOut, type KioskState } from "@/app/(public)/attendance-portal/actions";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function KioskClock() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<{ detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } | null>(null);
  const jsqrRef = useRef<typeof import("jsqr").default | null>(null);
  const scanTimer = useRef<number | null>(null);

  const [mode, setMode] = useState<"in" | "out">("in");
  const [employeeNo, setEmployeeNo] = useState("");
  const [passcode, setPasscode] = useState("");
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [obConfirm, setObConfirm] = useState<string | null>(null);
  const pendingQr = useRef<string | undefined>(undefined);

  const startCamera = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamReady(true);
    } catch {
      setCamError("Camera unavailable. A photo is required to clock in/out — please enable the camera.");
      setCamReady(false);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (scanTimer.current) clearInterval(scanTimer.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera]);

  /** Grab the current frame as a JPEG blob (the enforced attendance photo). */
  function captureBlob(): Promise<Blob | null> {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return Promise.resolve(null);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.7));
  }

  function stopScan() {
    if (scanTimer.current) {
      clearInterval(scanTimer.current);
      scanTimer.current = null;
    }
    setScanning(false);
  }

  async function run(confirmOb: boolean, qrToken?: string) {
    setBusy(true);
    setMsg(null);

    const photo = await captureBlob();
    if (!photo) {
      setBusy(false);
      setMsg({ tone: "err", text: "A photo is required. Please enable the camera and try again." });
      return;
    }

    const fd = new FormData();
    if (qrToken) fd.append("qr_token", qrToken);
    else {
      fd.append("employee_no", employeeNo);
      fd.append("passcode", passcode);
    }
    fd.append("photo", photo, "kiosk.jpg");
    if (confirmOb) fd.append("confirm_ob_cancel", "true");

    const res: KioskState = mode === "in" ? await portalCheckIn(undefined, fd) : await portalCheckOut(undefined, fd);
    setBusy(false);

    if (res?.ok) {
      setMsg({ tone: "ok", text: res.message });
      setEmployeeNo("");
      setPasscode("");
      setObConfirm(null);
      pendingQr.current = undefined;
      router.refresh();
      return;
    }
    if (res && "needsObConfirm" in res && res.needsObConfirm) {
      pendingQr.current = qrToken;
      setObConfirm(res.message);
      return;
    }
    setMsg({ tone: "err", text: (res && "error" in res && res.error) || "Something went wrong." });
  }

  /** Decode a QR from the current frame — native BarcodeDetector, else jsqr. */
  async function decodeFrame(): Promise<string | null> {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !video.videoWidth || !canvas) return null;

    if ("BarcodeDetector" in window) {
      if (!detectorRef.current) {
        const Detector = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => typeof detectorRef.current }).BarcodeDetector;
        detectorRef.current = new Detector({ formats: ["qr_code"] });
      }
      try {
        const codes = await detectorRef.current!.detect(video);
        return codes[0]?.rawValue ?? null;
      } catch {
        return null;
      }
    }

    // Fallback: jsqr on the raw pixels (works on any browser).
    if (!jsqrRef.current) jsqrRef.current = (await import("jsqr")).default;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsqrRef.current(img.data, img.width, img.height)?.data ?? null;
  }

  async function startScan() {
    setScanning(true);
    setMsg(null);
    scanTimer.current = window.setInterval(async () => {
      const token = await decodeFrame();
      if (token) {
        stopScan();
        await run(false, token);
      }
    }, 400);
  }

  const canSubmit = employeeNo.trim() && passcode.trim() && !busy && camReady;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["in", "out"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setMsg(null); setObConfirm(null); }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              mode === m ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {m === "in" ? "Clock In" : "Clock Out"}
          </button>
        ))}
      </div>

      <div className="relative mb-1 aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-900">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {scanning && (
          <div className="absolute inset-0 grid place-items-center bg-black/30 text-sm font-medium text-white">
            <div className="rounded-lg bg-black/50 px-3 py-2">Point the QR badge at the camera…</div>
          </div>
        )}
        {camError && (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-slate-300">{camError}</div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="mb-3 text-center text-[11px] text-slate-400">Your photo is captured automatically when you clock {mode}.</p>

      <button
        type="button"
        onClick={scanning ? stopScan : startScan}
        disabled={busy || !camReady}
        className="mb-3 w-full rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
      >
        {scanning ? "Cancel scan" : "📷 Scan QR badge"}
      </button>

      <div className="mb-1 text-center text-xs text-slate-400">or enter manually</div>
      <div className="space-y-2">
        <input value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} placeholder="ID number" className={inputCls} autoComplete="off" />
        <input value={passcode} onChange={(e) => setPasscode(e.target.value)} type="password" inputMode="numeric" placeholder="Passcode" className={inputCls} autoComplete="off" />
      </div>

      {obConfirm ? (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{obConfirm}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => run(true, pendingQr.current)} disabled={busy} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">
              Agree & check in
            </button>
            <button type="button" onClick={() => setObConfirm(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
              Keep my OB
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => run(false)}
          disabled={!canSubmit}
          className={`mt-3 w-full rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-50 ${
            mode === "in" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
          }`}
        >
          {busy ? "Please wait…" : mode === "in" ? "Clock In" : "Clock Out"}
        </button>
      )}

      {msg && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
