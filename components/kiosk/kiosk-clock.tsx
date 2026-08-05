"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { portalCheckIn, portalCheckOut, validateQrToken, type KioskState } from "@/app/(public)/attendance-portal/actions";
import { Celebrate } from "@/components/kiosk/celebrate";
import { t, type Lang } from "@/lib/i18n";

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

type Window = { start: string; end: string };

function parseWindows(raw: string): Window[] {
  return raw
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean)
    .map((w) => {
      const [start, end] = w.split("-").map((x) => x.trim());
      return { start, end };
    })
    .filter((w) => /^\d{2}:\d{2}$/.test(w.start) && /^\d{2}:\d{2}$/.test(w.end));
}

/** Current Manila time as "HH:MM" for rush-window comparison. */
function manilaHM(): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

export function KioskClock({
  cameraSeconds = 45,
  cameraRushSeconds = 180,
  rushWindows = "",
  lang = "en",
}: {
  cameraSeconds?: number;
  cameraRushSeconds?: number;
  rushWindows?: string;
  lang?: Lang;
}) {
  const tr = (k: string) => t(lang, k);
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const jsqrRef = useRef<typeof import("jsqr").default | null>(null);
  const scanTimer = useRef<number | null>(null);
  const countdownTimer = useRef<number | null>(null);

  const windows = parseWindows(rushWindows);

  const [mode, setMode] = useState<"in" | "out">("in");
  const [employeeNo, setEmployeeNo] = useState("");
  const [passcode, setPasscode] = useState("");
  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [obConfirm, setObConfirm] = useState<string | null>(null);
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [scannedLabel, setScannedLabel] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<"on_time" | "late" | null>(null);
  const pendingQr = useRef<string | undefined>(undefined);

  const isRush = () => {
    const hm = manilaHM();
    return windows.some((w) => hm >= w.start && hm <= w.end);
  };

  const stopCamera = useCallback(() => {
    if (countdownTimer.current) { clearInterval(countdownTimer.current); countdownTimer.current = null; }
    if (scanTimer.current) { clearInterval(scanTimer.current); scanTimer.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
    setCamReady(false);
    setSecondsLeft(0);
  }, []);

  /** Start (or restart) the auto-off countdown; longer inside a rush window. */
  const startCountdown = useCallback(() => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    const total = isRush() ? cameraRushSeconds : cameraSeconds;
    setSecondsLeft(total);
    countdownTimer.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { stopCamera(); return 0; }
        return s - 1;
      });
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraSeconds, cameraRushSeconds, stopCamera]);

  const startCamera = useCallback(async () => {
    setCamError(null);
    setMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamReady(true);
      startCountdown();
    } catch {
      setCamError("Camera unavailable. A photo is required to clock in/out — please enable the camera.");
      setCamReady(false);
    }
  }, [startCountdown]);

  // Stop everything on unmount.
  useEffect(() => () => stopCamera(), [stopCamera]);

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
    if (scanTimer.current) { clearInterval(scanTimer.current); scanTimer.current = null; }
    setScanning(false);
  }

  async function run(confirmOb: boolean, qrToken?: string) {
    setBusy(true);
    setMsg(null);

    const photo = await captureBlob();
    if (!photo) {
      setBusy(false);
      setMsg({ tone: "err", text: "A photo is required. Please turn on the camera and try again." });
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
      if (mode === "in" && res.punctual) setCelebrate(res.punctual);
      setEmployeeNo("");
      setPasscode("");
      setObConfirm(null);
      setScannedToken(null);
      setScannedLabel(null);
      pendingQr.current = undefined;
      startCountdown(); // keep the camera on for the next person; reset the timer
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

  /** Decode a QR from the current frame with jsqr (reliable on every browser). */
  async function decodeFrame(): Promise<string | null> {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !video.videoWidth || !canvas) return null;

    if (!jsqrRef.current) jsqrRef.current = (await import("jsqr")).default;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return jsqrRef.current(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" })?.data ?? null;
  }

  async function startScan() {
    setScanning(true);
    setMsg(null);
    const track = streamRef.current?.getVideoTracks()[0];
    try {
      await track?.applyConstraints({ advanced: [{ focusMode: "continuous" }] } as unknown as MediaTrackConstraints);
    } catch { /* not all cameras support focus control */ }
    scanTimer.current = window.setInterval(async () => {
      const token = await decodeFrame();
      if (!token) return;
      stopScan();
      const res = await validateQrToken(token);
      if (res.ok) {
        setScannedToken(token);
        setScannedLabel(res.label);
        setMsg({ tone: "ok", text: `Badge accepted: ${res.label}. Tap Clock In or Clock Out.` });
      } else {
        setMsg({ tone: "err", text: res.error });
      }
    }, 400);
  }

  const canSubmit = (Boolean(scannedToken) || (employeeNo.trim() && passcode.trim())) && !busy && camReady;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      {celebrate && <Celebrate kind={celebrate} onDone={() => setCelebrate(null)} />}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["in", "out"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setMsg(null); setObConfirm(null); }}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              mode === m ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            {m === "in" ? tr("clock_in") : tr("clock_out")}
          </button>
        ))}
      </div>

      <div className="relative mb-1 aspect-[4/3] w-full overflow-hidden rounded-xl bg-stone-900">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />

        {/* Camera-off overlay with the turn-on button. */}
        {!camReady && (
          <div className="absolute inset-0 grid place-items-center bg-stone-900/90 p-4 text-center">
            <div>
              <button
                type="button"
                onClick={startCamera}
                className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700"
              >
                📷 {tr("turn_on_camera")}
              </button>
              <p className="mt-2 text-xs text-stone-400">{camError ?? "The camera stays on only while you clock in/out."}</p>
            </div>
          </div>
        )}

        {camReady && secondsLeft > 0 && (
          <div className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
            {tr("camera_on")} · {secondsLeft}s
          </div>
        )}
        {scanning && (
          <div className="absolute inset-0 grid place-items-center bg-black/30 text-sm font-medium text-white">
            <div className="rounded-lg bg-black/50 px-3 py-2">Point the QR badge at the camera…</div>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {camReady ? (
        <div className="mb-3 mt-1 flex items-center justify-between text-[11px] text-stone-400">
          <span>Photo captured automatically when you clock {mode}.</span>
          <span className="flex gap-2">
            <button type="button" onClick={startCountdown} className="font-medium text-amber-700 hover:underline">{tr("extend")}</button>
            <button type="button" onClick={stopCamera} className="font-medium text-stone-500 hover:underline">{tr("turn_off")}</button>
          </span>
        </div>
      ) : (
        <p className="mb-3 mt-1 text-center text-[11px] text-stone-400">{tr("turn_on_to_clock")}</p>
      )}

      <button
        type="button"
        onClick={scanning ? stopScan : startScan}
        disabled={busy || !camReady}
        className="mb-3 w-full rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
      >
        {scanning ? tr("cancel_scan") : `📷 ${tr("scan_qr")}`}
      </button>

      {scannedToken ? (
        <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <span>✓ {scannedLabel ?? "Badge"} — tap Clock {mode === "in" ? "In" : "Out"}.</span>
          <button type="button" onClick={() => { setScannedToken(null); setScannedLabel(null); setMsg(null); }} className="text-xs font-medium text-emerald-700 hover:underline">
            clear
          </button>
        </div>
      ) : (
        <>
          <div className="mb-1 text-center text-xs text-stone-400">{tr("or_enter_manually")}</div>
          <div className="space-y-2">
            <input value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} placeholder={tr("id_number")} className={inputCls} autoComplete="off" />
            <input value={passcode} onChange={(e) => setPasscode(e.target.value)} type="password" inputMode="numeric" placeholder={tr("passcode")} className={inputCls} autoComplete="off" />
          </div>
        </>
      )}

      {obConfirm ? (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{obConfirm}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => run(true, pendingQr.current)} disabled={busy} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">
              Agree & check in
            </button>
            <button type="button" onClick={() => setObConfirm(null)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700">
              Keep my OB
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => run(false, scannedToken ?? undefined)}
          disabled={!canSubmit}
          title={!camReady ? "Turn on the camera first" : undefined}
          className={`mt-3 w-full rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-50 ${
            mode === "in" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
          }`}
        >
          {busy ? tr("please_wait") : mode === "in" ? tr("clock_in") : tr("clock_out")}
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
