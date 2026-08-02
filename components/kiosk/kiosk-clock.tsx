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

  const [mode, setMode] = useState<"in" | "out">("in");
  const [employeeNo, setEmployeeNo] = useState("");
  const [passcode, setPasscode] = useState("");
  const [captured, setCaptured] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [obConfirm, setObConfirm] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCamError("Camera unavailable — you can still clock in, but a photo is preferred.");
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, [startCamera]);

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
    setCaptured(canvas.toDataURL("image/jpeg", 0.7));
    canvas.toBlob((b) => setBlob(b), "image/jpeg", 0.7);
  }

  function reset() {
    setPasscode("");
    setEmployeeNo("");
    setCaptured(null);
    setBlob(null);
    setObConfirm(null);
  }

  async function run(confirmOb: boolean) {
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("employee_no", employeeNo);
    fd.append("passcode", passcode);
    if (blob) fd.append("photo", blob, "kiosk.jpg");
    if (confirmOb) fd.append("confirm_ob_cancel", "true");
    const res: KioskState = mode === "in" ? await portalCheckIn(undefined, fd) : await portalCheckOut(undefined, fd);
    setBusy(false);

    if (res?.ok) {
      setMsg({ tone: "ok", text: res.message });
      reset();
      router.refresh();
      return;
    }
    if (res && "needsObConfirm" in res && res.needsObConfirm) {
      setObConfirm(res.message);
      return;
    }
    setMsg({ tone: "err", text: (res && "error" in res && res.error) || "Something went wrong." });
  }

  const canSubmit = employeeNo.trim() && passcode.trim() && !busy;

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

      <div className="relative mb-3 aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-900">
        <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${captured ? "hidden" : "block"}`} />
        {captured && <img src={captured} alt="Captured" className="h-full w-full object-cover" />}
        {camError && !captured && (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-slate-300">{camError}</div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <div className="mb-2 flex gap-2">
        {!captured ? (
          <button type="button" onClick={capture} disabled={Boolean(camError)} className="flex-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            Take photo
          </button>
        ) : (
          <button type="button" onClick={() => { setCaptured(null); setBlob(null); }} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Retake
          </button>
        )}
      </div>

      <div className="space-y-2">
        <input value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} placeholder="ID number" className={inputCls} autoComplete="off" />
        <input value={passcode} onChange={(e) => setPasscode(e.target.value)} type="password" inputMode="numeric" placeholder="Passcode" className={inputCls} autoComplete="off" />
      </div>

      {obConfirm ? (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p>{obConfirm}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => run(true)} disabled={busy} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700">
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
