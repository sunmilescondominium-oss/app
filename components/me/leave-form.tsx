"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requestLeave, requestOB, requestGeneral, cancelLeave, type ActionResult } from "@/app/(app)/me/actions";
import { LEAVE_TYPES, LEAVE_MIN_LEAD_DAYS, REQUEST_TYPES } from "@/lib/config";

const cls =
  "rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function LeaveForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(requestLeave, undefined);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
        <select name="leave_type" defaultValue={LEAVE_TYPES[0]} className={cls}>
          {LEAVE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
        <input type="date" name="start_date" required className={cls} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
        <input type="date" name="end_date" required className={cls} />
      </div>
      <div className="min-w-[10rem] flex-1">
        <label className="mb-1 block text-xs font-medium text-slate-600">Reason</label>
        <input name="reason" placeholder="Optional" className={`${cls} w-full`} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Request leave"}
      </button>
      <p className="w-full text-xs text-slate-400">Please file at least {LEAVE_MIN_LEAD_DAYS} days ahead so coverage can be arranged.</p>
      {state && !state.ok && <p className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

export function ObForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(requestOB, undefined);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">OB date</label>
        <input type="date" name="start_date" required className={cls} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Until (optional)</label>
        <input type="date" name="end_date" className={cls} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Duration</label>
        <select name="duration" defaultValue="whole_day" className={cls}>
          <option value="whole_day">Whole day</option>
          <option value="half_day">Half day</option>
        </select>
      </div>
      <div className="min-w-[10rem] flex-1">
        <label className="mb-1 block text-xs font-medium text-slate-600">Where / purpose</label>
        <input name="reason" placeholder="e.g. City Hall permit" className={`${cls} w-full`} />
      </div>
      <button type="submit" disabled={pending} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
        {pending ? "Submitting…" : "File OB"}
      </button>
      <p className="w-full text-xs text-slate-400">Official Business needs approval. It is auto-cancelled if you clock in on that day.</p>
      {state && !state.ok && <p className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

export function RequestForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(requestGeneral, undefined);
  const [category, setCategory] = useState<string>(REQUEST_TYPES[0].key);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  const needsHours = REQUEST_TYPES.find((t) => t.key === category)?.needsHours;

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Request</label>
        <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={cls}>
          {REQUEST_TYPES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Date</label>
        <input type="date" name="date" required className={cls} />
      </div>
      {needsHours && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Hours</label>
          <input type="number" name="hours" step="0.5" min="0" max="24" className={`${cls} w-20`} />
        </div>
      )}
      {category === "other" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Subject</label>
          <input name="subject" placeholder="e.g. Certificate" className={cls} />
        </div>
      )}
      <div className="min-w-[10rem] flex-1">
        <label className="mb-1 block text-xs font-medium text-slate-600">Details</label>
        <input name="reason" placeholder="Optional" className={`${cls} w-full`} />
      </div>
      <button type="submit" disabled={pending} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
        {pending ? "Submitting…" : "Submit request"}
      </button>
      {state && !state.ok && <p className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

export function CancelLeave({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onCancel() {
    if (!window.confirm("Cancel this request?")) return;
    setBusy(true);
    const res = await cancelLeave(id);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }
  return (
    <button type="button" onClick={onCancel} disabled={busy} className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50">
      cancel
    </button>
  );
}
