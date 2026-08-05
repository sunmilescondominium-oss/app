"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setKioskSettings } from "@/app/(app)/employees/actions";

export function KioskSettingsPanel({
  accessCode,
  showPhotos,
  cameraSeconds,
  cameraRushSeconds,
  rushWindows,
}: {
  accessCode: string;
  showPhotos: boolean;
  cameraSeconds: number;
  cameraRushSeconds: number;
  rushWindows: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState(accessCode);
  const [photos, setPhotos] = useState(showPhotos);
  const [secs, setSecs] = useState(cameraSeconds);
  const [rushSecs, setRushSecs] = useState(cameraRushSeconds);
  const [windows, setWindows] = useState(rushWindows);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await setKioskSettings(code, photos, { seconds: secs, rushSeconds: rushSecs, rushWindows: windows });
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="no-print flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Kiosk access code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="blank = open"
          className="w-40 rounded-lg border border-stone-300 px-2.5 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm text-stone-700">
        <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} className="h-4 w-4" />
        Show photos on board
      </label>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Camera on (sec)</label>
        <input type="number" min={5} max={600} value={secs} onChange={(e) => setSecs(Number(e.target.value))} className="w-24 rounded-lg border border-stone-300 px-2.5 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Camera on — rush (sec)</label>
        <input type="number" min={5} max={1800} value={rushSecs} onChange={(e) => setRushSecs(Number(e.target.value))} className="w-24 rounded-lg border border-stone-300 px-2.5 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Rush windows</label>
        <input value={windows} onChange={(e) => setWindows(e.target.value)} placeholder="06:00-09:00,16:00-19:00" className="w-52 rounded-lg border border-stone-300 px-2.5 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200" />
      </div>
      <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        {busy ? "Saving…" : "Save kiosk settings"}
      </button>
      <p className="w-full text-xs text-stone-400">
        A code locks the public kiosk to devices that enter it once. Turn off photos to show initials only. The kiosk camera turns on only when someone clocks in/out and switches off after the seconds above — longer during rush windows (morning arrival / afternoon departure), Manila time.
      </p>
    </div>
  );
}
