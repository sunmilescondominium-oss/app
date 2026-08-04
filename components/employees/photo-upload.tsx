"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadStaffPhoto } from "@/app/(app)/employees/actions";

const FRAME = 260; // on-screen editor frame (px)
const OUT = 512; // exported square size (px)

export function PhotoUpload({ userId }: { userId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const [src, setSrc] = useState<string | null>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  const baseScale = nat.w && nat.h ? FRAME / Math.min(nat.w, nat.h) : 1;
  const scale = baseScale * zoom;
  const drawnW = nat.w * scale;
  const drawnH = nat.h * scale;
  const left = FRAME / 2 - drawnW / 2 + offset.x;
  const top = FRAME / 2 - drawnH / 2 + offset.y;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNat({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setSrc(url);
    };
    img.src = url;
    if (fileRef.current) fileRef.current.value = "";
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    setOffset({ x: d.ox + (e.clientX - d.x), y: d.oy + (e.clientY - d.y) });
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function close() {
    if (src) URL.revokeObjectURL(src);
    setSrc(null);
    imgRef.current = null;
  }

  async function save() {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, OUT, OUT);
    const s = OUT / FRAME;
    ctx.drawImage(img, left * s, top * s, drawnW * s, drawnH * s);

    const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.85));
    if (!blob) return;
    const file = new File([blob], "photo.jpg", { type: "image/jpeg" });

    setBusy(true);
    const fd = new FormData();
    fd.append("photo", file);
    const resu = await uploadStaffPhoto(userId, fd);
    setBusy(false);
    if (!resu.ok) { window.alert(resu.error); return; }
    close();
    router.refresh();
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        Photo
      </button>

      {src && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <p className="mb-3 text-sm font-semibold text-stone-800">Align &amp; zoom the photo</p>

            <div
              className="relative mx-auto touch-none overflow-hidden rounded-full ring-2 ring-amber-400 select-none"
              style={{ width: FRAME, height: FRAME }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt="preview"
                draggable={false}
                style={{ position: "absolute", left, top, width: drawnW, height: drawnH, maxWidth: "none" }}
              />
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button type="button" onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(2)))} className="h-8 w-8 rounded-lg border border-stone-300 text-lg font-bold text-stone-600 hover:bg-stone-50">−</button>
              <input type="range" min={1} max={4} step={0.02} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-amber-600" />
              <button type="button" onClick={() => setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)))} className="h-8 w-8 rounded-lg border border-stone-300 text-lg font-bold text-stone-600 hover:bg-stone-50">+</button>
            </div>
            <p className="mt-1 text-center text-[11px] text-stone-400">Drag the photo to align · pinch/slider to zoom</p>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={close} className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">Cancel</button>
              <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
                {busy ? "Saving…" : "Save photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
