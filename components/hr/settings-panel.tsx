"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPayrollSettings } from "@/app/(app)/hr/actions";
import type { PayrollSettings } from "@/lib/hr/payroll";

const cls =
  "w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

export function PayrollSettingsPanel({ settings }: { settings: PayrollSettings }) {
  const router = useRouter();
  const [s, setS] = useState(settings);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof PayrollSettings>(k: K, v: PayrollSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  async function save() {
    setBusy(true);
    const res = await setPayrollSettings(s);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="no-print rounded-2xl border border-slate-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-slate-800">Payroll rules (Labor Code)</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Field label="Scheduled time-in">
          <input type="time" value={s.scheduled_time_in.slice(0, 5)} onChange={(e) => set("scheduled_time_in", e.target.value)} className={cls} />
        </Field>
        <Field label="Standard hours" hint="net of break">
          <input type="number" step="0.5" value={s.standard_hours} onChange={(e) => set("standard_hours", Number(e.target.value))} className={cls} />
        </Field>
        <Field label="Break (hrs)" hint="unpaid meal">
          <input type="number" step="0.5" value={s.break_hours} onChange={(e) => set("break_hours", Number(e.target.value))} className={cls} />
        </Field>
        <Field label="Grace (min)" hint="tardiness allowance">
          <input type="number" value={s.grace_minutes} onChange={(e) => set("grace_minutes", Number(e.target.value))} className={cls} />
        </Field>
        <Field label="Half-day ≤ (hrs)">
          <input type="number" step="0.5" value={s.half_day_hours} onChange={(e) => set("half_day_hours", Number(e.target.value))} className={cls} />
        </Field>
        <Field label="Late round-up (min)" hint="> this = full hour">
          <input type="number" value={s.late_round_up_minutes} onChange={(e) => set("late_round_up_minutes", Number(e.target.value))} className={cls} />
        </Field>
        <Field label="Auto check-out" hint="if no overtime">
          <input type="time" value={s.auto_checkout_time.slice(0, 5)} onChange={(e) => set("auto_checkout_time", e.target.value)} className={cls} />
        </Field>
        <Field label="OT multiplier" hint="125% = 1.25">
          <input type="number" step="0.05" value={s.ot_multiplier} onChange={(e) => set("ot_multiplier", Number(e.target.value))} className={cls} />
        </Field>
        <Field label="Night diff rate" hint="10% = 0.10">
          <input type="number" step="0.01" value={s.night_diff_rate} onChange={(e) => set("night_diff_rate", Number(e.target.value))} className={cls} />
        </Field>
        <Field label="Night start">
          <input type="time" value={s.night_start.slice(0, 5)} onChange={(e) => set("night_start", e.target.value)} className={cls} />
        </Field>
        <Field label="Night end">
          <input type="time" value={s.night_end.slice(0, 5)} onChange={(e) => set("night_end", e.target.value)} className={cls} />
        </Field>
        <div className="flex items-end">
          <button type="button" onClick={save} disabled={busy} className="w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
            {busy ? "Saving…" : "Save rules"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        TODO(client-confirm): defaults follow DOLE norms (8h day, OT 125%, night diff 10% for 10PM–6AM). Adjust to your company policy.
      </p>
    </div>
  );
}
