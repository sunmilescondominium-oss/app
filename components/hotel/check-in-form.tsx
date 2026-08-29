"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { checkIn, type CheckInResult } from "@/app/(app)/hotel/actions";
import { roomCharge, promoDiscount, round2 } from "@/lib/hotel/rates";
import { peso } from "@/lib/collections/summary";
import { HOTEL_PAYMENT_METHODS } from "@/lib/config";
import type { RatePlan, Promo } from "@/lib/hotel/types";
import { DiscountIdCapture } from "@/components/hotel/discount-id-capture";

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

export function CheckInForm({
  unitId,
  ratePlans,
  promos,
  suggestedArNo,
  extraPersonRate = 0,
  onDone,
}: {
  unitId: string;
  ratePlans: RatePlan[];
  promos: Promo[];
  suggestedArNo?: string;
  extraPersonRate?: number;
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
  const today = new Date().toISOString().slice(0, 10);
  const validPromos = promos.filter(
    (p) => (!p.valid_from || p.valid_from <= today) && (!p.valid_until || p.valid_until >= today),
  );
  const promo = validPromos.find((p) => p.id === promoId);
  const requiresCoupon = promo?.requires_coupon ?? false;

  // govDiscType: what the dropdown currently shows
  // discountApplied: true only after cashier clicks "Apply & capture ID"
  const [govDiscType, setGovDiscType] = useState<string>("");
  const [discountApplied, setDiscountApplied] = useState(false);
  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [advanceMethod, setAdvanceMethod] = useState<string>(HOTEL_PAYMENT_METHODS[0]?.key ?? "cash");
  const [clientError, setClientError] = useState("");
  const [extraPersons, setExtraPersons] = useState(0);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const effHours = plan ? Math.max(hours, plan.base_hours) : hours;
  const rc = plan ? roomCharge(plan.base_rate, plan.extra_hour_rate, plan.base_hours, effHours) : 0;
  const promoDisc = promo ? promoDiscount(rc, promo.disc_type, promo.disc_value) : 0;
  const afterPromo = round2(rc - promoDisc);

  // Apply gov't discount to price preview only after cashier explicitly applies it.
  const isGovDisc = discountApplied && (govDiscType === "pwd" || govDiscType === "senior_citizen");
  const govDisc = isGovDisc ? round2(afterPromo * 0.20) : 0;
  const extraPersonAmt = round2(Math.max(0, extraPersons) * extraPersonRate);
  const required = Math.max(0, round2(rc - promoDisc - govDisc + extraPersonAmt));
  const [advanceAmount, setAdvanceAmount] = useState<number>(required);

  useEffect(() => { setAdvanceAmount(required); }, [required]);

  useEffect(() => {
    if (state?.ok) { onDone(); router.push(`/hotel/${state.stayId}`); }
  }, [state, onDone, router]);

  // Pending discount = selected but not yet applied
  const isPendingDisc = (govDiscType === "pwd" || govDiscType === "senior_citizen") && !discountApplied;
  // Camera shows once applied; button enables only after photo captured
  const showCamera = isGovDisc;
  const checkInBlocked = isGovDisc && !photoCaptured;

  function applyDiscount() {
    setDiscountApplied(true);
    setPhotoCaptured(false);
    setClientError("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    setClientError("");
    if (isGovDisc && !photoCaptured) {
      e.preventDefault();
      setClientError("Capture the government ID photo to enable check-in.");
    }
  }

  return (
    <form action={action} onSubmit={handleSubmit} className="space-y-4">
      {/* Hidden file input — populated by DiscountIdCapture via DataTransfer */}
      <input ref={photoInputRef} type="file" name="discount_id_photo" accept="image/jpeg" className="hidden" />

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
        <div>
          <label className={labelCls}>Promo (optional)</label>
          <select name="promo_id" value={promoId} onChange={(e) => setPromoId(e.target.value)} className={inputCls}>
            <option value="">— none —</option>
            {validPromos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.disc_type === "percent" ? `${p.disc_value}%` : peso(p.disc_value)}){p.valid_until ? ` · until ${p.valid_until}` : ""}
              </option>
            ))}
          </select>
        </div>
        {requiresCoupon && (
          <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <label className={labelCls}>Promo coupon / card # (required by guard)</label>
            <input
              name="promo_coupon_no"
              className={inputCls}
              placeholder="e.g. PROMO-001"
              style={{ textTransform: "uppercase" }}
              required
            />
            <p className="mt-0.5 text-[10px] text-amber-800">Guard must have recorded this number at the entrance before check-in.</p>
          </div>
        )}
        <div>
          <label className={labelCls}>Gov&apos;t discount (optional)</label>
          <select
            name="discount_type"
            value={govDiscType}
            onChange={(e) => {
              setGovDiscType(e.target.value);
              setDiscountApplied(false);
              setPhotoCaptured(false);
              setClientError("");
            }}
            className={inputCls}
          >
            <option value="">— none —</option>
            <option value="pwd">PWD — 20% discount</option>
            <option value="senior_citizen">Senior Citizen — 20% discount</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Total guests in party *</label>
          <input
            name="guest_count"
            type="number"
            min={1}
            max={20}
            defaultValue={extraPersons + 1}
            className={inputCls}
            required
          />
          <p className="mt-0.5 text-[10px] text-stone-400">Guard will verify this count at the gate.</p>
        </div>
        <div>
          <label className={labelCls}>
            Extra persons charged{extraPersonRate > 0 ? ` (₱${extraPersonRate.toLocaleString("en-PH")}/person)` : " (rate not set)"}
          </label>
          <input
            name="extra_persons"
            type="number"
            min={0}
            value={extraPersons}
            onChange={(e) => { setExtraPersons(Math.max(0, parseInt(e.target.value, 10) || 0)); }}
            className={inputCls}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Referral plate # (optional)</label>
          <input
            name="referral_plate"
            className={inputCls}
            placeholder="e.g. ABC 123"
            style={{ textTransform: "uppercase" }}
          />
          <p className="mt-0.5 text-[10px] text-stone-400">Enter only if a tricycle/vehicle brought the guest. Must match guard entrance log.</p>
        </div>
      </div>

      {/* Step 1: Recompute button — appears after selecting a discount type */}
      {isPendingDisc && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex-1 text-xs text-amber-900">
            <strong>{govDiscType === "pwd" ? "PWD" : "Senior Citizen"} 20% discount selected.</strong>{" "}
            Click to recompute the room fee and open the camera to capture the ID card.
          </div>
          <button
            type="button"
            onClick={applyDiscount}
            className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Recompute &amp; Capture ID →
          </button>
        </div>
      )}

      {/* Step 2: Camera — appears after Recompute is clicked */}
      {showCamera && (
        <DiscountIdCapture
          discountType={govDiscType as "pwd" | "senior_citizen"}
          fileInputRef={photoInputRef}
          onCaptured={() => { setPhotoCaptured(true); setClientError(""); }}
          onCleared={() => setPhotoCaptured(false)}
        />
      )}

      {/* Price breakdown */}
      <div className="rounded-lg bg-stone-50 px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-stone-500">Room charge</span>
          <span className="tabular-nums">{peso(rc)}</span>
        </div>
        {promoDisc > 0 && (
          <div className="flex justify-between text-emerald-700">
            <span>Promo discount</span>
            <span className="tabular-nums">− {peso(promoDisc)}</span>
          </div>
        )}
        {govDisc > 0 && (
          <div className="flex justify-between text-amber-700">
            <span>{govDiscType === "pwd" ? "PWD" : "Senior Citizen"} 20% discount</span>
            <span className="tabular-nums">− {peso(govDisc)}</span>
          </div>
        )}
        {extraPersonAmt > 0 && (
          <div className="flex justify-between text-stone-700">
            <span>{extraPersons} extra person{extraPersons !== 1 ? "s" : ""}</span>
            <span className="tabular-nums">+ {peso(extraPersonAmt)}</span>
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

      {clientError && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {clientError}
        </p>
      )}
      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
          Cancel
        </button>
        {checkInBlocked && (
          <span className="text-xs text-stone-400">Capture ID photo to enable check-in</span>
        )}
        <button
          type="submit"
          disabled={pending || checkInBlocked}
          title={checkInBlocked ? "Capture the government ID photo first" : undefined}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Checking in…" : "Check in"}
        </button>
      </div>
    </form>
  );
}
