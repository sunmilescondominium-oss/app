"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadHousekeepingPhoto } from "@/app/(app)/housekeeping/actions";
import { CameraCapture } from "@/components/capture/camera-capture";

const AREAS = ["Bed", "Toilet", "Room", "Kitchen", "Other"];

export function CleaningPhotos({ taskId, count, canWrite }: { taskId: string; count: number; canWrite: boolean }) {
  const router = useRouter();
  const [area, setArea] = useState("Bed");
  const [busy, setBusy] = useState(false);

  async function onCapture(file: File, capturedAt: string) {
    setBusy(true);
    const fd = new FormData();
    fd.append("photo", file);
    fd.append("area", area.toLowerCase());
    fd.append("captured_at", capturedAt);
    const res = await uploadHousekeepingPhoto(taskId, fd);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="mb-2 text-sm font-semibold text-stone-700">Cleaning photos</p>

      {count > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {Array.from({ length: count }).map((_, i) => (
            <a key={i} href={`/api/housekeeping/${taskId}/photo?i=${i}`} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/housekeeping/${taskId}/photo?i=${i}`} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-lg object-cover ring-1 ring-stone-200" />
            </a>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-xs text-stone-400">No photos yet — take pictures of the bed, toilet, and room after cleaning.</p>
      )}

      {canWrite && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={area} onChange={(e) => setArea(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm">
            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <CameraCapture label={`Housekeeping · ${area}`} buttonText="Take cleaning photo" busy={busy} onCapture={onCapture} />
        </div>
      )}
    </div>
  );
}
