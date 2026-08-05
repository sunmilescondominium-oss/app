"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requestLeave, requestOB, requestGeneral, cancelLeave, type ActionResult } from "@/app/(app)/me/actions";
import { LEAVE_TYPES, LEAVE_MIN_LEAD_DAYS, REQUEST_TYPES } from "@/lib/config";
import { t, type Lang } from "@/lib/i18n";

const cls =
  "rounded-lg border border-stone-300 px-2.5 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const lbl = "mb-1 block text-xs font-medium text-stone-600";

export function LeaveForm({ lang = "en" }: { lang?: Lang }) {
  const router = useRouter();
  const tr = (k: string) => t(lang, k);
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(requestLeave, undefined);
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-2xl border border-stone-200 bg-white p-4">
      <div>
        <label className={lbl}>{tr("f_type")}</label>
        <select name="leave_type" defaultValue={LEAVE_TYPES[0]} className={cls}>
          {LEAVE_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div>
        <label className={lbl}>{tr("f_from")}</label>
        <input type="date" name="start_date" required className={cls} />
      </div>
      <div>
        <label className={lbl}>{tr("f_to")}</label>
        <input type="date" name="end_date" required className={cls} />
      </div>
      <div className="min-w-[10rem] flex-1">
        <label className={lbl}>{tr("f_reason")}</label>
        <input name="reason" placeholder={tr("f_optional")} className={`${cls} w-full`} />
      </div>
      <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        {pending ? tr("f_submitting") : tr("f_request_leave")}
      </button>
      <p className="w-full text-xs text-stone-400">{tr("f_lead_note")} ({LEAVE_MIN_LEAD_DAYS}d)</p>
      {state && !state.ok && <p className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

export function ObForm({ lang = "en" }: { lang?: Lang }) {
  const router = useRouter();
  const tr = (k: string) => t(lang, k);
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(requestOB, undefined);
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
      <div>
        <label className={lbl}>{tr("f_ob_date")}</label>
        <input type="date" name="start_date" required className={cls} />
      </div>
      <div>
        <label className={lbl}>{tr("f_until_opt")}</label>
        <input type="date" name="end_date" className={cls} />
      </div>
      <div>
        <label className={lbl}>{tr("f_duration")}</label>
        <select name="duration" defaultValue="whole_day" className={cls}>
          <option value="whole_day">{tr("f_whole_day")}</option>
          <option value="half_day">{tr("f_half_day")}</option>
        </select>
      </div>
      <div className="min-w-[10rem] flex-1">
        <label className={lbl}>{tr("f_where")}</label>
        <input name="reason" placeholder="e.g. City Hall permit" className={`${cls} w-full`} />
      </div>
      <button type="submit" disabled={pending} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
        {pending ? tr("f_submitting") : tr("f_file_ob")}
      </button>
      <p className="w-full text-xs text-stone-400">{tr("f_ob_note")}</p>
      {state && !state.ok && <p className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

export function RequestForm({ lang = "en" }: { lang?: Lang }) {
  const router = useRouter();
  const tr = (k: string) => t(lang, k);
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(requestGeneral, undefined);
  const [category, setCategory] = useState<string>(REQUEST_TYPES[0].key);
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  const needsHours = REQUEST_TYPES.find((x) => x.key === category)?.needsHours;

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-2xl border border-stone-200 bg-white p-4">
      <div>
        <label className={lbl}>{tr("f_request")}</label>
        <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={cls}>
          {REQUEST_TYPES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
      </div>
      <div>
        <label className={lbl}>{tr("f_date")}</label>
        <input type="date" name="date" required className={cls} />
      </div>
      {needsHours && (
        <div>
          <label className={lbl}>{tr("f_hours")}</label>
          <input type="number" name="hours" step="0.5" min="0" max="24" className={`${cls} w-20`} />
        </div>
      )}
      {category === "other" && (
        <div>
          <label className={lbl}>{tr("f_subject")}</label>
          <input name="subject" placeholder="e.g. Certificate" className={cls} />
        </div>
      )}
      <div className="min-w-[10rem] flex-1">
        <label className={lbl}>{tr("f_details")}</label>
        <input name="reason" placeholder={tr("f_optional")} className={`${cls} w-full`} />
      </div>
      <button type="submit" disabled={pending} className="rounded-lg bg-stone-700 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60">
        {pending ? tr("f_submitting") : tr("f_submit_request")}
      </button>
      {state && !state.ok && <p className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

export function CancelLeave({ id, lang = "en" }: { id: string; lang?: Lang }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onCancel() {
    if (!window.confirm(t(lang, "f_cancel_confirm"))) return;
    setBusy(true);
    const res = await cancelLeave(id);
    setBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    router.refresh();
  }
  return (
    <button type="button" onClick={onCancel} disabled={busy} className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50">
      {t(lang, "f_cancel")}
    </button>
  );
}
