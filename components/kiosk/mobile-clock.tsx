"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validateFallbackCode, mobileCheckIn, mobileCheckOut, type MobileState } from "@/app/(public)/mobile-clock/actions";
import { Celebrate } from "@/components/kiosk/celebrate";

const inputCls = "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

/** Best-effort phone location; resolves to zeros if unavailable/declined. */
function getGeo(): Promise<{ lat: number; lng: number; acc: number }> {
  return new Promise((res) => {
    if (!navigator.geolocation) return res({ lat: 0, lng: 0, acc: 0 });
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => res({ lat: 0, lng: 0, acc: 0 }),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
    );
  });
}

export function MobileClock() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"in" | "out">("in");
  const [employeeNo, setEmployeeNo] = useState("");
  const [passcode, setPasscode] = useState("");
  const [camReady, setCamReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [celebrate, setCelebrate] = useState<"on_time" | "late" | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamReady(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  async function unlock() {
    setBusy(true);
    setMsg(null);
    const res = await validateFallbackCode(code);
    setBusy(false);
    if (res.ok) { setUnlocked(true); setMsg(null); }
    else setMsg({ tone: "err", text: res.error });
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCamReady(true);
    } catch {
      setMsg({ tone: "err", text: "Camera unavailable — a photo is required to clock in/out." });
    }
  }

  function captureBlob(): Promise<Blob | null> {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return Promise.resolve(null);
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((r) => canvas.toBlob((b) => r(b), "image/jpeg", 0.7));
  }

  async function run() {
    setBusy(true);
    setMsg(null);
    const photo = await captureBlob();
    if (!photo) { setBusy(false); setMsg({ tone: "err", text: "Turn on the camera and take your photo first." }); return; }
    const geo = await getGeo();
    const fd = new FormData();
    fd.append("code", code);
    fd.append("employee_no", employeeNo);
    fd.append("passcode", passcode);
    fd.append("photo", photo, "mobile.jpg");
    fd.append("geo_lat", String(geo.lat));
    fd.append("geo_lng", String(geo.lng));
    fd.append("geo_accuracy", String(geo.acc));

    const res: MobileState = mode === "in" ? await mobileCheckIn(undefined, fd) : await mobileCheckOut(undefined, fd);
    setBusy(false);
    if (res?.ok) {
      setMsg({ tone: "ok", text: res.message });
      if (mode === "in" && res.punctual) setCelebrate(res.punctual);
      setEmployeeNo(""); setPasscode("");
      return;
    }
    setMsg({ tone: "err", text: (res && "error" in res && res.error) || "Something went wrong." });
  }

  if (!unlocked) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-stone-800">Enter access code</h2>
        <p className="mb-3 text-sm text-stone-500">Ask the guard on duty for the temporary code shown in their portal.</p>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. K7P2QX" className={`${inputCls} text-center text-lg font-semibold tracking-widest`} autoComplete="off" />
        <button type="button" onClick={unlock} disabled={busy || code.trim().length < 4} className="mt-3 w-full rounded-lg bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
          {busy ? "Checking…" : "Unlock"}
        </button>
        {msg && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg.text}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      {celebrate && <Celebrate kind={celebrate} onDone={() => setCelebrate(null)} />}

      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["in", "out"] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setMsg(null); }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === m ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}>
            {m === "in" ? "Clock In" : "Clock Out"}
          </button>
        ))}
      </div>

      <div className="relative mb-1 aspect-[3/4] w-full overflow-hidden rounded-xl bg-stone-900">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {!camReady && (
          <div className="absolute inset-0 grid place-items-center bg-stone-900/90 p-4 text-center">
            <button type="button" onClick={startCamera} className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700">📷 Turn on camera</button>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="mb-3 mt-1 text-center text-[11px] text-stone-400">Your photo, device IP and location are recorded for verification.</p>

      <div className="space-y-2">
        <input value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} placeholder="ID number" className={inputCls} autoComplete="off" />
        <input value={passcode} onChange={(e) => setPasscode(e.target.value)} type="password" inputMode="numeric" placeholder="Passcode" className={inputCls} autoComplete="off" />
      </div>

      <button type="button" onClick={run} disabled={busy || !camReady || !employeeNo.trim() || !passcode.trim()} className={`mt-3 w-full rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-50 ${mode === "in" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}`}>
        {busy ? "Please wait…" : mode === "in" ? "Clock In" : "Clock Out"}
      </button>

      {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
