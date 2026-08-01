"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRatePlan, createPromo, type ActionResult } from "@/app/(app)/hotel/actions";
import { peso } from "@/lib/collections/summary";
import type { RatePlan, Promo } from "@/lib/hotel/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function RatePromoManager({
  ratePlans,
  promos,
  onDone,
}: {
  ratePlans: RatePlan[];
  promos: Promo[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [planState, planAction, planPending] = useActionState<ActionResult | undefined, FormData>(createRatePlan, undefined);
  const [promoState, promoAction, promoPending] = useActionState<ActionResult | undefined, FormData>(createPromo, undefined);

  useEffect(() => {
    if (planState?.ok || promoState?.ok) router.refresh();
  }, [planState, promoState, router]);

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Rate plans</p>
        <ul className="mb-3 space-y-1 text-sm">
          {ratePlans.map((p) => (
            <li key={p.id} className="flex justify-between rounded-lg border border-slate-200 px-3 py-1.5">
              <span>{p.name}</span>
              <span className="text-slate-500">
                {peso(p.base_rate)} / {p.base_hours}h · +{peso(p.extra_hour_rate)}/h
              </span>
            </li>
          ))}
        </ul>
        <form action={planAction} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input name="name" placeholder="Name" className={`${inputCls} col-span-2 sm:col-span-1`} />
          <input name="base_hours" type="number" placeholder="Hours" defaultValue="3" className={inputCls} />
          <input name="base_rate" type="number" placeholder="Base ₱" className={inputCls} />
          <input name="extra_hour_rate" type="number" placeholder="Extra/h ₱" className={inputCls} />
          <button type="submit" disabled={planPending} className="col-span-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 sm:col-span-4">
            {planPending ? "Adding…" : "Add rate plan"}
          </button>
        </form>
        {planState && !planState.ok && <p className="mt-1 text-sm text-red-700">{planState.error}</p>}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Promos</p>
        <ul className="mb-3 space-y-1 text-sm">
          {promos.map((p) => (
            <li key={p.id} className="flex justify-between rounded-lg border border-slate-200 px-3 py-1.5">
              <span>{p.name}</span>
              <span className="text-slate-500">{p.disc_type === "percent" ? `${p.disc_value}%` : peso(p.disc_value)}</span>
            </li>
          ))}
          {promos.length === 0 && <li className="text-slate-400">No promos yet.</li>}
        </ul>
        <form action={promoAction} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input name="name" placeholder="Name" className={`${inputCls} col-span-2`} />
          <select name="disc_type" defaultValue="percent" className={inputCls}>
            <option value="percent">% off</option>
            <option value="amount">₱ off</option>
          </select>
          <input name="disc_value" type="number" placeholder="Value" className={inputCls} />
          <button type="submit" disabled={promoPending} className="col-span-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 sm:col-span-4">
            {promoPending ? "Adding…" : "Add promo"}
          </button>
        </form>
        {promoState && !promoState.ok && <p className="mt-1 text-sm text-red-700">{promoState.error}</p>}
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onDone} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Close
        </button>
      </div>
    </div>
  );
}
