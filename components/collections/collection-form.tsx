"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  createCollectionBatch,
  getUnitCharges,
  type ChargeSuggestion,
  type ActionResult,
} from "@/app/(app)/collections/actions";
import {
  COLLECTION_CATEGORIES,
  COLLECTION_CHARGE_TYPES,
  BILLING_ITEM_TYPES,
  PAYMENT_TYPES,
} from "@/lib/config";
import type { UnitOption } from "@/lib/collections/types";
import { CameraCapture } from "@/components/capture/camera-capture";

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

const RECEIPT_TYPES = [
  { key: "OR", label: "OR — Official Receipt" },
  { key: "SI", label: "SI — Sales Invoice" },
  { key: "AR", label: "AR — Acknowledgement Receipt" },
  { key: "PR", label: "PR — Provisional Receipt (postdated check)" },
] as const;

// Build charge type dropdown from all billing item types (unified)
const ALL_CHARGE_TYPES = [
  ...BILLING_ITEM_TYPES,
  ...COLLECTION_CHARGE_TYPES.filter((c) => !BILLING_ITEM_TYPES.find((b) => b.key === c.key)),
];

const COLLECTED_BY = [
  { key: "hotel_rental_monitoring", label: "Hotel & Rental Monitoring" },
  { key: "hotel_cashier", label: "Hotel Cashier" },
  { key: "accounting", label: "Accounting" },
  { key: "guard", label: "Guard" },
  { key: "errand_liaison", label: "Errand & Liaison" },
];

// Categories where a unit/room picker is shown
const UNIT_CATS = new Set(["rental", "hotel", "airbnb", "condo_sales"]);

const CHARGE_LABELS: Record<string, string> = Object.fromEntries(
  COLLECTION_CHARGE_TYPES.map((c) => [c.key, c.label]),
);

interface ChargeRow extends ChargeSuggestion {
  localAmount: string;
  localOrNumber: string;
  localChargeType: string;
  localLabel: string;
  bill_id: string | null;
  outstanding: number;
}

export function CollectionForm({
  date,
  unitOptions,
  bankMap = {},
  onDone,
}: {
  date: string;
  unitOptions: UnitOption[];
  bankMap?: Record<string, string>;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(
    createCollectionBatch,
    undefined,
  );

  // Step 1 — category
  const [category, setCategory] = useState("rental");
  const needsUnit = UNIT_CATS.has(category);

  // Step 2 — unit
  const [unitId, setUnitId] = useState("");
  const [chargeRows, setChargeRows] = useState<ChargeRow[]>([]);
  const [loadingCharges, startChargeTransition] = useTransition();

  // Step 3 — payment
  const [paymentType, setPaymentType] = useState("cash");
  const isCheck = paymentType === "check";
  const isCash = paymentType === "cash";
  const isOnline = !isCash && !isCheck;

  // Auto-set receipt type to PR when postdated check detected
  const [checkDate, setCheckDate] = useState("");
  const today = date; // collected_on date
  const isPostdated = isCheck && checkDate && checkDate > today;
  const [receiptType, setReceiptType] = useState("OR");

  // Sync receipt type when postdated status changes
  useEffect(() => {
    if (isPostdated && receiptType !== "PR") setReceiptType("PR");
  }, [isPostdated, receiptType]);

  const [proof, setProof] = useState<{ file: File; at: string } | null>(null);

  useEffect(() => {
    if (state?.ok) { onDone(); setProof(null); }
  }, [state, onDone]);

  // Load charge suggestions when unit changes
  function handleUnitChange(id: string) {
    setUnitId(id);
    setChargeRows([]);
    if (!id) return;
    startChargeTransition(async () => {
      const suggestions = await getUnitCharges(id, category);
      setChargeRows(
        suggestions.map((s) => ({
          ...s,
          localAmount: s.amount != null ? String(s.amount) : "",
          localOrNumber: s.or_number ?? "",
          localChargeType: s.charge_type,
          localLabel: s.label,
          bill_id: s.bill_id ?? null,
          outstanding: s.outstanding ?? 0,
        })),
      );
    });
  }

  // Also reload when category changes (unit already selected)
  function handleCategoryChange(cat: string) {
    setCategory(cat);
    setUnitId("");
    setChargeRows([]);
  }

  function addBlankRow() {
    const key = `manual-${Date.now()}`;
    setChargeRows((rows) => [
      ...rows,
      {
        key,
        charge_type: "miscellaneous",
        label: "Additional charge",
        amount: null,
        outstanding: 0,
        or_number: null,
        bill_id: null,
        include: true,
        localAmount: "",
        localOrNumber: "",
        localChargeType: "miscellaneous",
        localLabel: "Additional charge",
      },
    ]);
  }

  function removeRow(key: string) {
    setChargeRows((rows) => rows.filter((r) => r.key !== key));
  }

  function toggleRow(key: string) {
    setChargeRows((rows) =>
      rows.map((r) => (r.key === key ? { ...r, include: !r.include } : r)),
    );
  }
  function updateAmount(key: string, val: string) {
    setChargeRows((rows) =>
      rows.map((r) => (r.key === key ? { ...r, localAmount: val } : r)),
    );
  }
  function updateOrNumber(key: string, val: string) {
    setChargeRows((rows) =>
      rows.map((r) => (r.key === key ? { ...r, localOrNumber: val } : r)),
    );
  }
  function updateChargeType(key: string, val: string) {
    setChargeRows((rows) =>
      rows.map((r) => (r.key === key ? { ...r, localChargeType: val } : r)),
    );
  }
  function updateLabel(key: string, val: string) {
    setChargeRows((rows) =>
      rows.map((r) => (r.key === key ? { ...r, localLabel: val } : r)),
    );
  }

  // For non-unit categories: single amount row
  const [singleAmount, setSingleAmount] = useState("");
  const [singleOrNumber, setSingleOrNumber] = useState("");
  const [singleChargeType, setSingleChargeType] = useState("miscellaneous");

  function buildBatchJson(): string {
    if (needsUnit && chargeRows.length > 0) {
      return JSON.stringify(
        chargeRows
          .filter((r) => r.include && r.localAmount)
          .map((r) => ({
            key: r.key,
            charge_type: r.localChargeType,
            label: r.localLabel,
            amount: parseFloat(r.localAmount),
            or_number: r.localOrNumber || null,
            bill_id: r.bill_id ?? null,
            include: true,
          })),
      );
    }
    // Single-row mode (no unit, or unit not yet loaded)
    if (!singleAmount) return "[]";
    return JSON.stringify([{
      key: "single",
      charge_type: singleChargeType,
      label: CHARGE_LABELS[singleChargeType] ?? singleChargeType,
      amount: parseFloat(singleAmount),
      or_number: singleOrNumber || null,
      bill_id: null,
      include: true,
    }]);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("batch_json", buildBatchJson());
    if (proof) { fd.set("proof", proof.file); fd.set("captured_at", proof.at); }
    formAction(fd);
  }

  const includedRows = chargeRows.filter((r) => r.include && r.localAmount);
  const batchTotal = includedRows.reduce((s, r) => s + (parseFloat(r.localAmount) || 0), 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="collected_on" value={date} />

      {/* ── Step 1: Category + bank assignment ── */}
      <div>
        <label className={labelCls}>Category *</label>
        <select
          name="business_line"
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className={inputCls}
        >
          {COLLECTION_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        {bankMap[category] && (
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
            🏦 {bankMap[category]}
          </p>
        )}
      </div>

      {/* ── Step 2: Unit/Room (for unit-linked categories) ── */}
      {needsUnit && (
        <div>
          <label className={labelCls}>Unit / Room</label>
          <select
            name="unit_id"
            value={unitId}
            onChange={(e) => handleUnitChange(e.target.value)}
            className={inputCls}
          >
            <option value="">— select unit —</option>
            {unitOptions
              .filter((u) => u.business_line === category)
              .map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
          </select>
        </div>
      )}

      {/* ── Step 3a: Charge rows (unit selected) ── */}
      {needsUnit && unitId && (
        <div className="rounded-xl border border-stone-200 bg-stone-50/50">
          <div className="border-b border-stone-200 px-4 py-2.5 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Charges</p>
            {loadingCharges && <span className="text-xs text-stone-400">Loading…</span>}
          </div>
          {chargeRows.length === 0 && !loadingCharges && (
            <p className="px-4 py-3 text-xs text-stone-400">No pre-filled charges found — enter manually below.</p>
          )}
          {chargeRows.map((row) => (
            <div key={row.key} className={`border-b border-stone-100 last:border-0 px-4 py-3 ${row.include ? "" : "opacity-50"}`}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={row.include}
                  onChange={() => toggleRow(row.key)}
                  className="mt-1 h-4 w-4 accent-amber-600"
                />
                <div className="flex-1 space-y-2">

                  {row.outstanding > 0 && (
                    <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      ₱{row.outstanding.toLocaleString("en-PH", { minimumFractionDigits: 2 })} previous balance included
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="sm:col-span-2 space-y-1.5">
                      {row.key.startsWith("manual-") ? (
                        <>
                          <label className={labelCls}>Description *</label>
                          <input
                            value={row.localLabel}
                            onChange={(e) => updateLabel(row.key, e.target.value)}
                            disabled={!row.include}
                            placeholder="e.g. Penalty fee, Extra parking…"
                            className={inputCls}
                          />
                        </>
                      ) : (
                        <label className={labelCls}>{row.localLabel}</label>
                      )}
                      <select
                        value={row.localChargeType}
                        onChange={(e) => updateChargeType(row.key, e.target.value)}
                        disabled={!row.include}
                        className={inputCls}
                      >
                        {ALL_CHARGE_TYPES.map((ct) => (
                          <option key={ct.key} value={ct.key}>{ct.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Amount (₱) {row.include ? "*" : ""}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.localAmount}
                        onChange={(e) => updateAmount(row.key, e.target.value)}
                        disabled={!row.include}
                        placeholder="0.00"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>OR / Receipt #</label>
                      <input
                        value={row.localOrNumber}
                        onChange={(e) => updateOrNumber(row.key, e.target.value)}
                        disabled={!row.include}
                        placeholder="Optional"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
                {row.key.startsWith("manual-") && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    className="mt-1 text-stone-400 hover:text-red-500 text-lg leading-none"
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
          {/* Add item button */}
          <div className="border-t border-stone-100 px-4 py-2.5">
            <button
              type="button"
              onClick={addBlankRow}
              className="text-sm font-medium text-amber-700 hover:text-amber-900"
            >
              + Add item
            </button>
          </div>
          {includedRows.length > 1 && (
            <div className="flex items-center justify-between border-t border-stone-200 px-4 py-2 text-sm font-semibold">
              <span className="text-stone-500">{includedRows.length} charges</span>
              <span className="tabular-nums text-stone-800">
                Total ₱{batchTotal.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3b: Single charge (no unit or standalone) ── */}
      {(!needsUnit || !unitId) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Charge type</label>
            <select
              value={singleChargeType}
              onChange={(e) => setSingleChargeType(e.target.value)}
              className={inputCls}
            >
              {ALL_CHARGE_TYPES.map((ct) => (
                <option key={ct.key} value={ct.key}>{ct.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Amount (₱) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={singleAmount}
              onChange={(e) => setSingleAmount(e.target.value)}
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>OR / Receipt #</label>
            <input
              value={singleOrNumber}
              onChange={(e) => setSingleOrNumber(e.target.value)}
              placeholder="Official receipt #"
              className={inputCls}
            />
          </div>
        </div>
      )}

      {/* ── Step 4: Payment & Receipt type ── */}
      <div className="rounded-xl border border-stone-200 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Payment & Accountable Form</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Payment type *</label>
            <select
              name="payment_type"
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              className={inputCls}
            >
              {PAYMENT_TYPES.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Accountable form (receipt type) *</label>
            <select
              name="receipt_type"
              value={receiptType}
              onChange={(e) => setReceiptType(e.target.value)}
              className={inputCls}
            >
              {RECEIPT_TYPES.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
            {isPostdated && (
              <p className="mt-1 text-xs text-amber-700">
                ⚠ Check date is after collection date — auto-set to PR (Provisional Receipt).
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Step 5a: Check details ── */}
      {isCheck && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 space-y-3">
          <p className="text-xs font-semibold text-sky-800">Check payment details</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Check number *</label>
              <input name="check_number" required className={inputCls} placeholder="Check #" />
            </div>
            <div>
              <label className={labelCls}>Check date *</label>
              <input
                name="check_date"
                type="date"
                required
                value={checkDate}
                onChange={(e) => setCheckDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Bank *</label>
              <input name="check_bank" required className={inputCls} placeholder="Bank name" />
            </div>
          </div>
          {isPostdated && (
            <div className="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-800">
              <strong>Postdated check</strong> — a Provisional Receipt (PR) will be issued now. Accounting and the errand/liaison will be notified when the check is due for deposit on <strong>{checkDate}</strong>.
            </div>
          )}
        </div>
      )}

      {/* ── Step 5b: Online payment proof ── */}
      {isOnline && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 space-y-3">
          <p className="text-xs font-semibold text-sky-800">Online / digital payment proof</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Reference number *</label>
              <input name="reference_no" required className={inputCls} placeholder="GCash / bank ref #" />
            </div>
            <div>
              <label className={labelCls}>Proof photo</label>
              {proof ? (
                <p className="text-sm text-emerald-700">
                  ✓ Captured {new Date(proof.at).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" })}{" "}
                  <button type="button" onClick={() => setProof(null)} className="text-amber-700 underline">retake</button>
                </p>
              ) : (
                <CameraCapture label="Payment proof" buttonText="Photo the payment screen" onCapture={(f, at) => setProof({ file: f, at })} />
              )}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" name="payment_confirmed" className="h-4 w-4" />
            I received / verified this online payment.
          </label>
        </div>
      )}

      {/* ── Step 6: Collected by + Remarks ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Collected by (role)</label>
          <select name="collected_by_role" defaultValue={COLLECTED_BY[0].key} className={inputCls}>
            {COLLECTED_BY.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Remarks</label>
          <input name="remarks" className={inputCls} placeholder="Optional" />
        </div>
      </div>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || loadingCharges}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : loadingCharges ? "Loading charges…" : "Add collection"}
        </button>
      </div>
    </form>
  );
}
