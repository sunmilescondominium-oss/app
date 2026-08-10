"use client";

import { useActionState, useState } from "react";
import { Modal } from "@/components/modal";
import { revertTransmittal } from "@/app/(app)/transmittals/actions";

type ActionResult = { ok: true } | { ok: false; error: string };

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

export function RevertTransmittal({ id, status, canRevert }: { id: string; status: string; canRevert: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    revertTransmittal.bind(null, id),
    undefined,
  );

  if (!canRevert) return null;
  const locked = status === "reconciled";
  const isDeposited = status === "deposited";

  return (
    <div className="no-print">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
      >
        Revert to collections
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Revert transmittal to collections">
        {locked ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This transmittal is already <strong>reconciled</strong> — the books are closed. Coordinate any correction with accounting.
          </p>
        ) : (
          <form action={formAction} className="space-y-4">
            {isDeposited ? (
              <p className="rounded-lg bg-red-100 px-3 py-2 text-xs font-medium text-red-900">
                ⚠ This transmittal has already been <strong>deposited</strong>. Reverting will void the linked bank transaction and return all collections to the editable list. This action is irreversible and fully logged. Only proceed if there was an error in payment application.
              </p>
            ) : (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
                This un-links every collection from this transmittal (returning them to the editable collections list) and deletes the transmittal. Use only to fix an error in payment application. The action is logged.
              </p>
            )}

            <div>
              <label className={labelCls}>Justification *</label>
              <textarea name="justification" required rows={2} placeholder="Why is this transmittal being reverted?" className={inputCls} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>Employee code *</label>
                <input name="employee_no" required autoComplete="off" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Passcode *</label>
                <input name="passcode" type="password" required autoComplete="off" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Type <span className="font-mono font-semibold">CONFIRM EDIT</span> *</label>
                <input name="confirm_text" required autoComplete="off" placeholder="CONFIRM EDIT" className={inputCls} />
              </div>
            </div>

            {state && !state.ok && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
                Cancel
              </button>
              <button type="submit" disabled={pending} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                {pending ? "Reverting…" : "Revert transmittal"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
