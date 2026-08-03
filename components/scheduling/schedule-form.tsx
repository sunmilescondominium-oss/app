"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { assignShift, removeShift, type ActionResult } from "@/app/(app)/schedule/actions";

const cls = "rounded-lg border border-stone-300 px-2.5 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function AssignForm({ staff, date }: { staff: { id: string; label: string }[]; date: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(assignShift, undefined);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-2xl border border-stone-200 bg-white p-4">
      <input type="hidden" name="work_date" value={date} />
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Staff</label>
        <select name="user_id" required className={cls} defaultValue="">
          <option value="" disabled>Choose…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Start</label>
        <input type="time" name="start_time" className={cls} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">End</label>
        <input type="time" name="end_time" className={cls} />
      </div>
      <div className="min-w-[8rem] flex-1">
        <label className="mb-1 block text-xs font-medium text-stone-600">Note</label>
        <input name="note" placeholder="Optional" className={`${cls} w-full`} />
      </div>
      <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        {pending ? "Saving…" : "Assign shift"}
      </button>
      {state && !state.ok && <p className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

export function RemoveShift({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onRemove() {
    setBusy(true);
    const res = await removeShift(id);
    setBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }
  return (
    <button type="button" onClick={onRemove} disabled={busy} className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50">
      remove
    </button>
  );
}
