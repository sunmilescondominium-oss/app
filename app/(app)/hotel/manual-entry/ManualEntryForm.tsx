"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { recordManualHotelStay, type ActionResult } from "./actions";

interface Room { id: string; label: string }
interface LineItem { id: number; description: string; amount: string }

const QUICK_ITEMS = ["Bottled Water", "Towel", "Breakfast", "Snack", "Extra Linen", "Parking", "Laundry", "Amenity Kit"];

let _nextId = 1;
function nextId() { return _nextId++; }

export function ManualEntryForm({ rooms }: { rooms: Room[] }) {
  const [state, dispatch, pending] = useActionState<ActionResult | undefined, FormData>(
    recordManualHotelStay,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Incidentals line items
  const [items, setItems] = useState<LineItem[]>([]);
  // Extra persons
  const [extraPersons, setExtraPersons] = useState(0);
  const [extraPersonRate, setExtraPersonRate] = useState("");
  // Room rate + extension
  const [roomRate, setRoomRate] = useState("");
  const [extHours, setExtHours] = useState("");
  const [extRate, setExtRate] = useState("");

  // Computed totals shown to user (display only — server recomputes from fields)
  const roomTotal  = Number(roomRate || 0);
  const extTotal   = Number(extHours || 0) * Number(extRate || 0);
  const epTotal    = extraPersons * Number(extraPersonRate || 0);
  const lineTotal  = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const grandTotal = roomTotal + extTotal + epTotal + lineTotal;

  function addItem(description = "") {
    setItems((prev) => [...prev, { id: nextId(), description, amount: "" }]);
  }

  function updateItem(id: number, field: keyof LineItem, value: string) {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, [field]: value } : i));
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

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
    <form ref={formRef} action={dispatch} className="space-y-5">
      {state && !state.ok && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}

      {/* ── Context banner ── */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        For reconciliation use only — records hotel stays and collections that were manually captured while the system was offline.
      </div>

      {/* ── Room ── */}
      <Field label="Room *">
        <select name="unit_id" required className={inputCls}>
          <option value="">Select room…</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </Field>

      {/* ── Dates ── */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Check-in *">
          <input type="datetime-local" name="check_in_at" required className={inputCls} />
        </Field>
        <Field label="Check-out *">
          <input type="datetime-local" name="check_out_at" required className={inputCls} />
        </Field>
      </div>

      {/* ── Guest ── */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Guest name *">
          <input type="text" name="guest_label" required placeholder="e.g. Juan Dela Cruz" className={inputCls} />
        </Field>
        <Field label="Guest contact">
          <input type="text" name="guest_contact" placeholder="Phone or email (optional)" className={inputCls} />
        </Field>
      </div>

      {/* ─────────────────────────────────────────── */}
      {/* CHARGES                                    */}
      {/* ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Charges</p>

        {/* Room rate */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Room charge (PHP)">
            <input
              type="number" name="room_rate" min="0" step="0.01" placeholder="0.00"
              value={roomRate} onChange={(e) => setRoomRate(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Guest count">
            <input type="number" name="guest_count" min="1" defaultValue="1" className={inputCls} />
          </Field>
        </div>

        {/* Time extension */}
        <div>
          <p className="mb-2 text-xs font-medium text-stone-600">Time extension (if any)</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Extra hours">
              <input
                type="number" name="ext_hours" min="0" step="1" placeholder="0"
                value={extHours} onChange={(e) => setExtHours(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Rate per extra hour (PHP)">
              <input
                type="number" name="ext_rate" min="0" step="0.01" placeholder="0.00"
                value={extRate} onChange={(e) => setExtRate(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          {extHours && extRate && (
            <p className="mt-1 text-xs text-stone-500">
              Extension: {Number(extHours)} hr × PHP {Number(extRate).toFixed(2)} = <span className="font-semibold">PHP {extTotal.toFixed(2)}</span>
            </p>
          )}
        </div>

        {/* Extra persons */}
        <div>
          <p className="mb-2 text-xs font-medium text-stone-600">Extra persons (if any)</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Number of extra persons">
              <input
                type="number" name="extra_persons" min="0" defaultValue="0"
                value={extraPersons} onChange={(e) => setExtraPersons(Number(e.target.value))}
                className={inputCls}
              />
            </Field>
            <Field label="Rate per extra person (PHP)">
              <input
                type="number" name="extra_person_rate" min="0" step="0.01" placeholder="0.00"
                value={extraPersonRate} onChange={(e) => setExtraPersonRate(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          {extraPersons > 0 && extraPersonRate && (
            <p className="mt-1 text-xs text-stone-500">
              Extra persons: {extraPersons} × PHP {Number(extraPersonRate).toFixed(2)} = <span className="font-semibold">PHP {epTotal.toFixed(2)}</span>
            </p>
          )}
        </div>

        {/* Incidentals */}
        <div>
          <p className="mb-2 text-xs font-medium text-stone-600">Incidentals / other charges</p>

          {/* Quick-add chips */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_ITEMS.map((label) => (
              <button
                key={label} type="button"
                onClick={() => addItem(label)}
                className="rounded-full border border-stone-300 bg-white px-2.5 py-0.5 text-xs text-stone-600 hover:border-amber-400 hover:text-amber-700"
              >
                + {label}
              </button>
            ))}
          </div>

          {/* Line items */}
          {items.length > 0 && (
            <div className="space-y-2 mb-2">
              {items.map((item, idx) => (
                <div key={item.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    name={`item_desc_${idx}`}
                    value={item.description}
                    onChange={(e) => updateItem(item.id, "description", e.target.value)}
                    placeholder="Description"
                    className={inputCls + " flex-1"}
                  />
                  <input
                    type="number"
                    name={`item_amount_${idx}`}
                    value={item.amount}
                    onChange={(e) => updateItem(item.id, "amount", e.target.value)}
                    placeholder="Amount"
                    min="0" step="0.01"
                    className={inputCls + " w-28"}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-rose-400 hover:text-rose-600 text-sm font-bold px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden count for server */}
          <input type="hidden" name="item_count" value={items.length} />

          <button
            type="button" onClick={() => addItem()}
            className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800"
          >
            <span className="text-base leading-none">+</span> Add item
          </button>
        </div>

        {/* Grand total summary */}
        <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
          <div className="flex justify-between text-stone-500 text-xs">
            <span>Room charge</span><span>PHP {roomTotal.toFixed(2)}</span>
          </div>
          {extTotal > 0 && (
            <div className="flex justify-between text-stone-500 text-xs">
              <span>Time extension</span><span>PHP {extTotal.toFixed(2)}</span>
            </div>
          )}
          {epTotal > 0 && (
            <div className="flex justify-between text-stone-500 text-xs">
              <span>Extra persons ({extraPersons})</span><span>PHP {epTotal.toFixed(2)}</span>
            </div>
          )}
          {lineTotal > 0 && (
            <div className="flex justify-between text-stone-500 text-xs">
              <span>Incidentals</span><span>PHP {lineTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between border-t border-stone-200 pt-1 font-semibold text-stone-800">
            <span>Total</span><span>PHP {grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* ── Payment ── */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount collected (PHP)">
          <input
            type="number" name="amount" min="0" step="0.01"
            defaultValue={grandTotal > 0 ? grandTotal.toFixed(2) : "0.00"}
            key={grandTotal}
            className={inputCls}
          />
        </Field>
        <Field label="Payment method">
          <select name="method" className={inputCls}>
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="maya">Maya</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </Field>
      </div>

      {/* ── AR / OR ── */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="AR # (leave blank to auto-assign)">
          <input type="text" name="ar_no" placeholder="e.g. AR-0123" className={inputCls} />
        </Field>
        <Field label="OR # (leave blank to auto-assign)">
          <input type="text" name="or_no" placeholder="e.g. OR-0456" className={inputCls} />
        </Field>
      </div>

      {/* ── Remarks — required for manual entries ── */}
      <Field label="Remarks / reason *">
        <textarea
          name="remarks" rows={2} required
          placeholder="e.g. Manual entry — system offline Sept 8–9, paper receipt #45"
          className={inputCls}
        />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Record manual entry"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-stone-600">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 w-full";
