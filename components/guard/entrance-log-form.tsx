"use client";

import { useActionState, useEffect, useRef } from "react";
import { logEntry } from "@/app/(app)/guard/actions";

const inputCls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

const ENTRY_TYPES = [
  { key: "guest",    label: "🛎 Guest" },
  { key: "vehicle",  label: "🚗 Vehicle only" },
  { key: "visitor",  label: "👤 Visitor" },
  { key: "delivery", label: "📦 Delivery" },
  { key: "staff",    label: "🪪 Staff" },
];

const VEHICLE_TYPES = [
  { key: "tricycle",   label: "Tricycle" },
  { key: "car",        label: "Car" },
  { key: "van",        label: "Van" },
  { key: "motorcycle", label: "Motorcycle" },
  { key: "other",      label: "Other" },
];

export function EntranceLogForm({ hasActiveShift }: { hasActiveShift: boolean }) {
  const [state, action, pending] = useActionState(logEntry, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  if (!hasActiveShift) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
        Start your shift above before logging entries.
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-sm font-semibold text-stone-800">Log new entry</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Entry type *</label>
          <select name="entry_type" defaultValue="guest" className={inputCls}>
            {ENTRY_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Vehicle type</label>
          <select name="vehicle_type" defaultValue="tricycle" className={inputCls}>
            <option value="">— none —</option>
            {VEHICLE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Plate #</label>
          <input
            name="plate_number"
            className={inputCls}
            placeholder="e.g. ABC 123"
            style={{ textTransform: "uppercase" }}
          />
        </div>
        <div>
          <label className={labelCls}>Passengers</label>
          <input name="passenger_count" type="number" min={1} className={inputCls} placeholder="—" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Driver name (optional)</label>
          <input name="driver_name" className={inputCls} placeholder="—" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Notes (optional)</label>
          <input name="notes" className={inputCls} placeholder="Any remarks…" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Discount coupon / card # (if guest has one)</label>
          <input
            name="discount_coupon_no"
            className={inputCls}
            placeholder="e.g. PROMO-001"
            style={{ textTransform: "uppercase" }}
          />
          <p className="mt-0.5 text-[10px] text-stone-400">Record if guest presents a discount card or coupon. Required before cashier can apply coupon-based promos.</p>
        </div>
      </div>
      {state && !state.ok && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-xs font-medium text-emerald-700">✓ Entry logged.</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {pending ? "Logging…" : "Log Entry →"}
      </button>
    </form>
  );
}
