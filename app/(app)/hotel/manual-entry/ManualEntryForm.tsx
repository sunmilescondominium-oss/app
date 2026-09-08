"use client";

import { useActionState, useRef } from "react";
import { recordManualHotelStay, type ActionResult } from "./actions";

interface Room { id: string; label: string }

export function ManualEntryForm({ rooms }: { rooms: Room[] }) {
  const [state, dispatch, pending] = useActionState<ActionResult | undefined, FormData>(
    recordManualHotelStay,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <p className="font-semibold">Entry recorded successfully.</p>
        <p className="mt-1 text-xs text-emerald-700">
          The stay and collection have been posted. You can find it in the AR/OR register and collection report.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 rounded-lg bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Record another
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={dispatch} className="space-y-4">
      {state && !state.ok && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-stone-600">Room *</label>
        <select name="unit_id" required className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="">Select room…</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-stone-600">Check-in *</label>
          <input type="datetime-local" name="check_in_at" required
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-stone-600">Check-out *</label>
          <input type="datetime-local" name="check_out_at" required
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-stone-600">Guest name *</label>
        <input type="text" name="guest_label" required placeholder="e.g. Juan Dela Cruz"
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-stone-600">Guest contact</label>
        <input type="text" name="guest_contact" placeholder="Phone or email (optional)"
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-stone-600">Amount collected</label>
          <input type="number" name="amount" min="0" step="0.01" defaultValue="0"
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-stone-600">Payment method</label>
          <select name="method"
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-stone-600">AR # (leave blank to auto-assign)</label>
          <input type="text" name="ar_no" placeholder="e.g. AR-0123"
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-stone-600">OR # (leave blank to auto-assign)</label>
          <input type="text" name="or_no" placeholder="e.g. OR-0456"
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-stone-600">Remarks / reason</label>
        <textarea name="remarks" rows={2}
          placeholder="e.g. Manual entry — system offline Sept 8-9, receipt #45"
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Record manual entry"}
      </button>
    </form>
  );
}
