"use client";

import { useActionState, useEffect } from "react";
import {
  createDispute,
  updateDispute,
  type ActionResult,
} from "@/app/(app)/disputes/actions";
import { DISPUTE_STATUSES } from "@/lib/config";
import type { Dispute } from "@/lib/disputes/types";
import type { UnitOption } from "@/lib/collections/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-slate-600";

export function DisputeForm({
  mode,
  dispute,
  unitOptions,
  canSeeLawyerNotes,
  onDone,
}: {
  mode: "create" | "edit";
  dispute?: Dispute;
  unitOptions: UnitOption[];
  canSeeLawyerNotes: boolean;
  onDone: () => void;
}) {
  const action =
    mode === "edit" && dispute ? updateDispute.bind(null, dispute.id) : createDispute;
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>Issue / case *</label>
          <input name="issue_type" required defaultValue={dispute?.issue_type ?? ""} className={inputCls} placeholder="e.g. Unit 402 — CWT dispute" />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select name="status" defaultValue={dispute?.status ?? "open"} className={inputCls}>
            {DISPUTE_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Unit</label>
          <select name="unit_id" defaultValue={dispute?.unit_id ?? ""} className={inputCls}>
            <option value="">— none —</option>
            {unitOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Case reference</label>
          <input name="case_ref" defaultValue={dispute?.case_ref ?? ""} className={inputCls} placeholder="e.g. DHSUD RO4A-…" />
        </div>
        <div>
          <label className={labelCls}>Target date</label>
          <input name="target_date" type="date" defaultValue={dispute?.target_date ?? ""} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Last action</label>
          <input name="last_action" defaultValue={dispute?.last_action ?? ""} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Next action</label>
          <input name="next_action" defaultValue={dispute?.next_action ?? ""} className={inputCls} />
        </div>
        {canSeeLawyerNotes && (
          <div className="sm:col-span-2">
            <label className={labelCls}>Lawyer / legal-coordination notes (consultant only)</label>
            <textarea name="lawyer_notes" defaultValue={dispute?.lawyer_notes ?? ""} rows={3} className={inputCls} />
          </div>
        )}
      </div>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Add case"}
        </button>
      </div>
    </form>
  );
}
