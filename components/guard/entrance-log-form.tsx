"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { logEntry } from "@/app/(app)/guard/actions";

const inputCls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

const ENTRY_TYPES = [
  { key: "guest",      label: "🛎 Hotel Guest" },
  { key: "unit_owner", label: "🏠 Unit Owner" },
  { key: "renter",     label: "🔑 Renter / Tenant" },
  { key: "visitor",    label: "👤 Visitor" },
  { key: "delivery",   label: "📦 Delivery" },
  { key: "staff",      label: "🪪 Staff" },
  { key: "vehicle",    label: "🚗 Vehicle only" },
  { key: "other",      label: "⋯ Other" },
];

const VEHICLE_TYPES = [
  { key: "tricycle",   label: "Tricycle" },
  { key: "car",        label: "Car" },
  { key: "van",        label: "Van" },
  { key: "motorcycle", label: "Motorcycle" },
  { key: "other",      label: "Other" },
];

const PERSON_TYPES = ["guest", "unit_owner", "renter", "visitor", "delivery", "staff", "other"];
const VEHICLE_ONLY = ["vehicle"];

export function EntranceLogForm({ hasActiveShift }: { hasActiveShift: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(logEntry, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [entryType, setEntryType] = useState("guest");

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setEntryType("guest");
      router.refresh();
    }
  }, [state, router]);

  if (!hasActiveShift) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
        Start your shift above before logging entries.
      </div>
    );
  }

  const isPerson = PERSON_TYPES.includes(entryType);
  const isVehicleOnly = VEHICLE_ONLY.includes(entryType);
  const showVehicle = isPerson || isVehicleOnly; // everyone may have a vehicle

  return (
    <form ref={formRef} action={action} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-sm font-semibold text-stone-800">Log new entry</p>

      {/* Row 1: Entry type */}
      <div>
        <label className={labelCls}>Entry type *</label>
        <select
          name="entry_type"
          value={entryType}
          onChange={(e) => setEntryType(e.target.value)}
          className={inputCls}
        >
          {ENTRY_TYPES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Row 2: Person info (name + destination) */}
      {isPerson && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              {entryType === "delivery" ? "Courier / sender name" : "Name of person"}
            </label>
            <input
              name="visitor_name"
              className={inputCls}
              placeholder={entryType === "delivery" ? "e.g. J&T Express / Juan Dela Cruz" : "Full name"}
            />
          </div>
          <div>
            <label className={labelCls}>
              {entryType === "guest" ? "Room #" : "Unit / destination"}
            </label>
            <input
              name="destination_unit"
              className={inputCls}
              placeholder={entryType === "guest" ? "e.g. 101" : "e.g. Unit 3A"}
            />
          </div>
        </div>
      )}

      {/* Row 3: Vehicle info */}
      {showVehicle && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Vehicle type</label>
            <select name="vehicle_type" defaultValue="" className={inputCls}>
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
          {isPerson && (
            <div>
              <label className={labelCls}>Passengers</label>
              <input name="passenger_count" type="number" min={1} className={inputCls} placeholder="—" />
            </div>
          )}
        </div>
      )}

      {/* Row 4: Driver name (for guest/delivery with vehicle) */}
      {(entryType === "guest" || entryType === "delivery" || isVehicleOnly) && (
        <div>
          <label className={labelCls}>Driver name (optional)</label>
          <input name="driver_name" className={inputCls} placeholder="—" />
        </div>
      )}

      {/* Row 5: Notes */}
      <div>
        <label className={labelCls}>Notes / remarks (optional)</label>
        <input name="notes" className={inputCls} placeholder="Any remarks…" />
      </div>

      {/* Row 6: Discount coupon — hotel guests only */}
      {entryType === "guest" && (
        <div>
          <label className={labelCls}>Discount coupon / card # (if guest has one)</label>
          <input
            name="discount_coupon_no"
            className={inputCls}
            placeholder="e.g. PROMO-001"
            style={{ textTransform: "uppercase" }}
          />
          <p className="mt-0.5 text-[10px] text-stone-400">
            Record if guest presents a discount card or coupon. Required before cashier can apply coupon-based promos.
          </p>
        </div>
      )}

      {/* Future: ID photo + signature placeholders */}
      <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-2">
        <p className="text-[10px] text-stone-400">
          📷 <strong>ID photo</strong> and ✍️ <strong>digital signature</strong> capture will be available here
          once a tablet is assigned to the guard post.
        </p>
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
