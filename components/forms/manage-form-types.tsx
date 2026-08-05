"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFormType } from "@/app/(app)/forms/actions";
import type { FormType } from "@/lib/forms/types";

export function ManageFormTypes({ types }: { types: FormType[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null); setBusy(true);
    const res = await createFormType(code, name);
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setCode(""); setName(""); setOpen(false);
    router.refresh();
  }

  const input = "rounded-lg border border-stone-300 px-3 py-2 text-sm";
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-700">Form types</p>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-medium text-amber-700 hover:underline">{open ? "Cancel" : "+ Add form type"}</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {types.map((t) => <span key={t.id} className="rounded-full bg-white px-3 py-1 text-xs text-stone-700 ring-1 ring-stone-200"><b>{t.code}</b> · {t.name}</span>)}
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Code (e.g. DR)" className={`${input} w-32`} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Delivery Receipt)" className={`${input} flex-1`} />
          <button type="button" onClick={submit} disabled={busy || !code.trim() || !name.trim()} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">{busy ? "Adding…" : "Add"}</button>
          {err && <p className="w-full text-sm text-red-600">{err}</p>}
        </div>
      )}
    </div>
  );
}
