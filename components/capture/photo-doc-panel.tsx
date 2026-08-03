"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CameraCapture } from "@/components/capture/camera-capture";
import { uploadDocPhoto } from "@/app/(app)/docs/actions";
import type { DocEntity, DocPhoto } from "@/lib/docs/photos";

/**
 * Reusable "documentation photos" block: live camera capture + a gallery of
 * the record's stamped photos. Drop it on any detail page.
 */
export function PhotoDocPanel({
  entity, entityId, kind, title, label, canWrite, photos,
}: {
  entity: DocEntity;
  entityId: string;
  kind: string;
  title: string;
  label: string;
  canWrite: boolean;
  photos: DocPhoto[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const shown = photos.filter((p) => p.kind === kind);

  async function onCapture(file: File, capturedAt: string) {
    setBusy(true);
    const fd = new FormData();
    fd.append("photo", file);
    fd.append("captured_at", capturedAt);
    const res = await uploadDocPhoto(entity, entityId, kind, fd);
    setBusy(false);
    if (!res.ok) return window.alert(res.error);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <p className="mb-2 text-sm font-semibold text-stone-700">{title}</p>
      {shown.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {shown.map((p) => (
            <a key={p.id} href={`/api/doc-photos/${p.id}`} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/doc-photos/${p.id}`} alt={p.kind} className="h-20 w-20 rounded-lg object-cover ring-1 ring-stone-200" />
              {p.stale && <span className="mt-0.5 block text-center text-[10px] font-semibold text-rose-600">⚠ time off</span>}
            </a>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-xs text-stone-400">No photos yet.</p>
      )}
      {canWrite && <CameraCapture label={label} buttonText="Take photo" busy={busy} onCapture={onCapture} />}
    </div>
  );
}
