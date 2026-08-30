"use client";

import { useEffect, useRef, useState } from "react";
import { APP_BRAND_SHORT } from "@/lib/config";

const CONSENT_EN = (label: string) =>
  `A photo of your ${label} ID card is required to avail of this discount, for audit purposes as required by Philippine law. Your photo will be securely stored and automatically deleted after 48 hours in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173). By proceeding, you give your informed consent to this temporary processing of your personal data.`;

const CONSENT_TL = (label: string) =>
  `Ang larawan ng inyong ${label} ID card ay kinakailangan upang makuha ang diskwentong ito, bilang katuparan sa batas ng Pilipinas. Ang inyong larawan ay ligtas na itatago at awtomatikong mabubura pagkatapos ng 48 oras alinsunod sa Data Privacy Act of 2012 (Republic Act No. 10173). Sa pagpapatuloy, ibinibigay ninyo ang inyong pahintulot sa pansamantalang paggamit ng inyong personal na datos.`;

export function DiscountIdCapture({
  discountType,
  fileInputRef,
  onCaptured,
  onCleared,
}: {
  discountType: "pwd" | "senior_citizen";
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onCaptured: () => void;
  onCleared: () => void;
}) {
  const label = discountType === "pwd" ? "PWD" : "Senior Citizen";
  const [consented, setConsented] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreaming(true);
      }
    } catch {
      alert("Camera access is required to capture the ID photo. Please allow camera access and try again.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }

  useEffect(() => () => { stopCamera(); }, []);

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    // Timestamp watermark
    const now = new Date();
    const ts = now.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: true,
    });
    const stamp = `${label} ID — ${ts} (Asia/Manila) | ${APP_BRAND_SHORT}`;
    const fontSize = Math.max(13, Math.round(canvas.width / 50));
    ctx.font = `bold ${fontSize}px monospace`;
    const textWidth = ctx.measureText(stamp).width;
    const pad = 8;
    const barH = fontSize + pad * 2;
    ctx.fillStyle = "rgba(0,0,0,0.70)";
    ctx.fillRect(0, canvas.height - barH, canvas.width, barH);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(stamp, Math.max(pad, (canvas.width - textWidth) / 2), canvas.height - pad);

    canvas.toBlob((blob) => {
      if (!blob) return;
      // Attach to the hidden file input so FormData picks it up natively
      try {
        const dt = new DataTransfer();
        dt.items.add(new File([blob], "discount-id.jpg", { type: "image/jpeg" }));
        if (fileInputRef.current) fileInputRef.current.files = dt.files;
      } catch {
        // DataTransfer not supported (unlikely in modern browsers)
      }
      setPreview(canvas.toDataURL("image/jpeg", 0.85));
      stopCamera();
      onCaptured();
    }, "image/jpeg", 0.85);
  }

  function retake() {
    setPreview(null);
    if (fileInputRef.current) {
      try { fileInputRef.current.value = ""; } catch { /* read-only in some browsers */ }
    }
    onCleared();
    startCamera();
  }

  // Captured preview
  if (preview) {
    return (
      <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <p className="text-xs font-semibold text-emerald-800">ID photo captured</p>
        <img src={preview} alt="Captured government ID" className="max-h-40 w-full rounded border border-emerald-200 object-contain" />
        <p className="text-[11px] text-emerald-700">Timestamp embedded. Photo will be automatically deleted after 48 hours.</p>
        <button type="button" onClick={retake} className="text-xs font-medium text-amber-700 underline underline-offset-2">
          Retake photo
        </button>
      </div>
    );
  }

  // Consent gate
  if (!consented) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 space-y-3">
        <p className="text-xs font-bold text-rose-800 uppercase tracking-wide">{label} ID Photo Required</p>

        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-stone-600">🇵🇭 English</p>
          <p className="text-[11px] text-stone-700 leading-relaxed">{CONSENT_EN(label)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-stone-600">🇵🇭 Filipino</p>
          <p className="text-[11px] text-stone-700 leading-relaxed">{CONSENT_TL(label)}</p>
        </div>

        <label className="flex cursor-pointer items-start gap-2 rounded border border-rose-300 bg-white p-2">
          <input
            type="checkbox"
            className="mt-0.5 accent-rose-600"
            onChange={(e) => {
              if (e.target.checked) {
                setConsented(true);
                startCamera();
              }
            }}
          />
          <span className="text-[11px] font-medium text-stone-800">
            I understand and give my consent.{" "}
            <span className="text-stone-500">/ Naiintindihan ko at sumasang-ayon ako.</span>
          </span>
        </label>
      </div>
    );
  }

  // Camera viewfinder
  return (
    <div className="space-y-2 rounded-lg border border-stone-300 bg-stone-900 p-2">
      <p className="text-[11px] font-medium text-stone-300 text-center">
        Point the camera at the {label} ID card
      </p>
      <div className="relative aspect-video overflow-hidden rounded">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        {!streaming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-white text-xs">Starting camera…</p>
          </div>
        )}
        {streaming && (
          <div className="absolute bottom-1 left-0 right-0 flex justify-center">
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
              {new Date().toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour12: true })}
            </span>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <button
        type="button"
        onClick={capturePhoto}
        disabled={!streaming}
        className="w-full rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        📷 Capture ID Photo
      </button>
    </div>
  );
}
