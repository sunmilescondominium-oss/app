"use client";

import { useActionState, useState } from "react";
import { upsertRateCard, generateMonthlyBills } from "@/app/(app)/admin/rate-cards/actions";
import type { RcActionResult } from "@/app/(app)/admin/rate-cards/actions";

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

interface UnitOption {
  id: string;
  unit_number: string;
  business_line: string;
  properties: { name: string } | null;
}

interface ItemType {
  key: string;
  label: string;
  lines: string[];
}

export function RateCardManager({
  units,
  itemTypes,
}: {
  units: UnitOption[];
  itemTypes: ItemType[];
}) {
  const [rcState, rcAction, rcPending] = useActionState<RcActionResult | undefined, FormData>(
    upsertRateCard,
    undefined,
  );
  const [billState, billAction, billPending] = useActionState<RcActionResult | undefined, FormData>(
    generateMonthlyBills,
    undefined,
  );

  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedBl, setSelectedBl] = useState("");

  const filteredItems = itemTypes.filter((t) =>
    !selectedBl || t.lines.includes(selectedBl),
  );

  // Default period to first of current month
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  return (
    <div className="mb-6 space-y-4">
      {/* Add rate card */}
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-stone-800">Add / update rate card item</p>
        <form action={rcAction} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Unit *</label>
              <select
                name="unit_id"
                required
                value={selectedUnit}
                onChange={(e) => {
                  setSelectedUnit(e.target.value);
                  const u = units.find((u) => u.id === e.target.value);
                  setSelectedBl(u?.business_line ?? "");
                }}
                className={inputCls}
              >
                <option value="">— select unit —</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_number}
                    {u.properties ? ` (${u.properties.name})` : ""}
                    {" — "}{u.business_line}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Item type *</label>
              <select name="item_key" required className={inputCls}>
                <option value="">— select item —</option>
                {filteredItems.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Monthly amount (₱) *</label>
              <input
                name="monthly_amount"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Effective from *</label>
              <input
                name="effective_from"
                type="date"
                required
                defaultValue={defaultPeriod}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Effective until (leave blank = indefinite)</label>
              <input name="effective_until" type="date" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Custom label (optional)</label>
              <input
                name="label"
                placeholder="Leave blank to use item type label"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <input name="notes" placeholder="Optional" className={inputCls} />
          </div>
          {rcState && !rcState.ok && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{rcState.error}</p>
          )}
          {rcState?.ok && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">✓ Rate card saved.</p>
          )}
          <button
            type="submit"
            disabled={rcPending}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {rcPending ? "Saving…" : "Save rate card item"}
          </button>
        </form>
      </div>

      {/* Generate monthly bills */}
      <div className="rounded-xl border border-violet-200 bg-violet-50/30 p-4">
        <p className="mb-1 text-sm font-semibold text-stone-800">Generate monthly bills</p>
        <p className="mb-3 text-xs text-stone-500">
          Creates bill records for all units with active rate cards for the selected month.
          Already-existing bills are skipped (won&apos;t double-bill).
        </p>
        <form action={billAction} className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelCls}>Billing month (YYYY-MM-01) *</label>
            <input
              name="period_month"
              type="date"
              required
              defaultValue={defaultPeriod}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <button
            type="submit"
            disabled={billPending}
            className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
          >
            {billPending ? "Generating…" : "Generate bills"}
          </button>
          {billState && !billState.ok && (
            <p className="w-full rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{billState.error}</p>
          )}
          {billState?.ok && (
            <p className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              ✓ Bills generated. Collections form will now show pre-filled charges for this month.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
