"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setKioskSettings } from "@/app/(app)/employees/actions";

export function KioskSettingsPanel({ accessCode, showPhotos }: { accessCode: string; showPhotos: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState(accessCode);
  const [photos, setPhotos] = useState(showPhotos);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await setKioskSettings(code, photos);
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
      <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        {busy ? "Saving…" : "Save kiosk settings"}
      </button>
      <p className="w-full text-xs text-stone-400">
        A code locks the public kiosk to devices that enter it once. Turn off photos to show initials only.
      </p>
    </div>
  );
}
