"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadEmployeeDoc, deleteEmployeeDoc } from "@/app/(app)/employees/personnel-actions";
import { EMPLOYEE_DOC_TYPES } from "@/lib/config";
import type { EmployeeDoc } from "@/lib/employees/personnel";

export function EmployeeDocs({ userId, docs }: { userId: string; docs: EmployeeDoc[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(formData: FormData) {
    setBusy(true);
    const res = await uploadEmployeeDoc(userId, formData);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    formRef.current?.reset();
    router.refresh();
  }

  async function del(id: string) {
    if (!window.confirm("Delete this document?")) return;
    const res = await deleteEmployeeDoc(id, userId);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  const cls = "rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

  return (
    <div>
      <form ref={formRef} action={upload} className="mb-3 flex flex-wrap items-end gap-2">
        <select name="doc_type" defaultValue={EMPLOYEE_DOC_TYPES[0]} className={cls}>
          {EMPLOYEE_DOC_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input name="note" placeholder="Note (optional)" className={cls} />
        <input name="file" type="file" required className="text-sm" />
        <button type="submit" disabled={busy} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {busy ? "Uploading…" : "Upload"}
        </button>
      </form>

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {docs.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">No documents yet.</p>}
        {docs.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-slate-800">{d.doc_type}</p>
              <p className="text-xs text-slate-400">{d.created_at.slice(0, 10)}{d.note ? ` · ${d.note}` : ""}</p>
            </div>
            <div className="flex shrink-0 gap-3">
              <a href={`/api/employee-docs/${d.id}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-amber-700 hover:underline">view</a>
              <button type="button" onClick={() => del(d.id)} className="text-xs font-medium text-rose-600 hover:underline">delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
