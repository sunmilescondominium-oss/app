"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveEmployeeProfile } from "@/app/(app)/employees/personnel-actions";
import { EMPLOYMENT_TYPES } from "@/lib/config";
import type { EmployeeProfile } from "@/lib/employees/personnel";

const cls =
  "w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function Field({ label, name, defaultValue, type = "text" }: { label: string; name: string; defaultValue: string | null; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue ?? ""} className={cls} />
    </label>
  );
}

export function PersonnelForm({ userId, profile, fullName }: { userId: string; profile: EmployeeProfile | null; fullName: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const p = profile;

  async function onSubmit(formData: FormData) {
    setBusy(true);
    setSaved(false);
    const res = await saveEmployeeProfile(userId, formData);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Personal & contact</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Full name" name="full_name" defaultValue={fullName} />
          <Field label="Address" name="address" defaultValue={p?.address ?? null} />
          <Field label="Birthdate" name="birthdate" type="date" defaultValue={p?.birthdate ?? null} />
          <Field label="Phone" name="phone" defaultValue={p?.phone ?? null} />
          <Field label="Personal email" name="personal_email" type="email" defaultValue={p?.personal_email ?? null} />
          <Field label="Emergency contact" name="emergency_name" defaultValue={p?.emergency_name ?? null} />
          <Field label="Emergency phone" name="emergency_phone" defaultValue={p?.emergency_phone ?? null} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Government IDs <span className="font-normal text-slate-400">· private (RA 10173)</span></h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="SSS" name="sss_no" defaultValue={p?.sss_no ?? null} />
          <Field label="PhilHealth" name="philhealth_no" defaultValue={p?.philhealth_no ?? null} />
          <Field label="Pag-IBIG" name="pagibig_no" defaultValue={p?.pagibig_no ?? null} />
          <Field label="TIN" name="tin_no" defaultValue={p?.tin_no ?? null} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Employment</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Position / designation" name="position" defaultValue={p?.position ?? null} />
          <Field label="Department" name="department" defaultValue={p?.department ?? null} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Employment type</span>
            <select name="employment_type" defaultValue={p?.employment_type ?? ""} className={cls}>
              <option value="">—</option>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <Field label="Date hired" name="date_hired" type="date" defaultValue={p?.date_hired ?? null} />
          <Field label="Date regularized" name="date_regularized" type="date" defaultValue={p?.date_regularized ?? null} />
        </div>
      </section>

      <section>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Notes</span>
          <textarea name="notes" defaultValue={p?.notes ?? ""} rows={2} className={cls} />
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {busy ? "Saving…" : "Save 201 file"}
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
      </div>
    </form>
  );
}
