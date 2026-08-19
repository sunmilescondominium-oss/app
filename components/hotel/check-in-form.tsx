"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkIn, type CheckInResult } from "@/app/(app)/hotel/actions";
import { roomCharge, promoDiscount } from "@/lib/hotel/rates";
import { peso } from "@/lib/collections/summary";
import { HOTEL_PAYMENT_METHODS } from "@/lib/config";
import type { RatePlan, Promo } from "@/lib/hotel/types";

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

export function CheckInForm({
  unitId,
  ratePlans,
  promos,
  suggestedArNo,
  onDone,
}: {
  unitId: string;
  ratePlans: RatePlan[];
  promos: Promo[];
  suggestedArNo?: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<CheckInResult | undefined, FormData>(
    checkIn.bind(null, unitId),
    undefined,
  );

  const [planId, setPlanId] = useState(ratePlans[0]?.id ?? "");
  const plan = ratePlans.find((p) => p.id === planId);
  const [hours, setHours] = useState<number>(ratePlans[0]?.base_hours ?? 3);
  const [promoId, setPromoId] = useState("");
  const promo = promos.find((p) => p.id === promoId);
  const [advanceMethod, setAdvanceMethod] = useState<string>(HOTEL_PAYMENT_METHODS[0]?.key ?? "cash");

  const effHours = plan ? Math.max(hours, plan.base_hours) : hours;
  const rc = plan ? roomCharge(plan.base_rate, plan.extra_hour_rate, plan.base_hours, effHours) : 0;
  const disc = promo ? promoDiscount(rc, promo.disc_type, promo.disc_value) : 0;
  const required = Math.max(0, Math.round((rc - disc) * 100) / 100);
  const [advanceAmount, setAdvanceAmount] = useState<number>(required);

  // Keep the advance in step with the room fee as the plan/hours/promo change.
  useEffect(() => { setAdvanceAmount(required); }, [required]);

  // On success, jump to the folio to print the initial receipt (with QR).
  useEffect(() => {
    if (state?.ok) { onDone(); router.push(`/hotel/${state.stayId}`); }
  }, [state, onDone, router]);

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Guest label</label>
          <input name="guest_label" className={inputCls} placeholder="Guest / name or ref" />
        </div>
        <div>
          <label className={labelCls}>Contact (optional)</label>
          <input name="guest_contact" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Rate plan *</label>
          <select
            name="rate_plan_id"
            value={planId}
            onChange={(e) => {
              setPlanId(e.target.value);
              const p = ratePlans.find((x) => x.id === e.target.value);
              if (p) setHours(p.base_hours);
            }}
            className={inputCls}
          >
            {ratePlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {peso(p.base_rate)} / {p.base_hours}h
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Hours (min {plan?.base_hours ?? 3})</label>
          <input
            name="planned_hours"
            type="number"
            min={plan?.base_hours ?? 1}
            value={effHours}
            onChange={(e) => setHours(parseInt(e.target.value, 10) || plan?.base_hours || 1)}
            className={inputCls}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Promo (optional)</label>
          <select name="promo_id" value={promoId} onChange={(e) => setPromoId(e.target.value)} className={inputCls}>
            <option value="">— none —</option>
            {promos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.disc_type === "percent" ? `${p.disc_value}%` : peso(p.disc_value)})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg bg-stone-50 px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-stone-500">Room charge</span>
          <span className="tabular-nums">{peso(rc)}</span>
        </div>
        {disc > 0 && (
          <div className="flex justify-between text-emerald-700">
            <span>Discount</span>
            <span className="tabular-nums">− {peso(disc)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-stone-200 pt-1 font-semibold">
          <span>Room fee — pay in advance</span>
          <span className="tabular-nums">{peso(required)}</span>
        </div>
      </div>

      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
        <p className="mb-2 text-xs font-semibold text-amber-900">Advance payment (required before entry)</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Method</label>
            <select name="advance_method" value={advanceMethod} onChange={(e) => setAdvanceMethod(e.target.value)} className={inputCls}>
              {HOTEL_PAYMENT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Amount collected</label>
            <input name="advance_amount" type="number" step="0.01" min={required} value={advanceAmount} onChange={(e) => setAdvanceAmount(Number(e.target.value))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>AR No (from booklet)</label>
            <input name="advance_ar_no" defaultValue={suggestedArNo ?? ""} className={inputCls} placeholder={suggestedArNo ?? "e.g. AR-002384"} />
          </div>
          <div>
            <label className={labelCls}>OR No (optional)</label>
            <input name="advance_or_no" className={inputCls} placeholder="Official Receipt #" />
          </div>
        </div>
        <p className="mt-1 text-[11px] text-amber-800">A thermal receipt with a QR (for the guest&rsquo;s online bill) prints on the folio after check-in.</p>
      </div>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {pending ? "Checking in…" : "Check in"}
        </button>
      </div>
    </form>
  );
}
