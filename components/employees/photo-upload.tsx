"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadStaffPhoto } from "@/app/(app)/employees/actions";

export function PhotoUpload({ userId }: { userId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("photo", file);
    const res = await uploadStaffPhoto(userId, fd);
    setBusy(false);
    if (ref.current) ref.current.value = "";
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      <input ref={ref} type="file" accept="image/*" hidden onChange={onChange} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Photo"}
      </button>
    </>
  );
}
