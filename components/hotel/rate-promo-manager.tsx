"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import {
  createRatePlan,
  updateRatePlan,
  deactivateRatePlan,
  createPromo,
  updatePromo,
  deactivatePromo,
  type ActionResult,
} from "@/app/(app)/hotel/actions";
import { peso } from "@/lib/collections/summary";
import type { RatePlan, Promo } from "@/lib/hotel/types";

const inputCls =
  "w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-[11px] font-medium text-stone-500";

// ---------------------------------------------------------------------------
// Rate plan row — view / inline-edit / deactivate
// ---------------------------------------------------------------------------
function RatePlanRow({ plan, onSaved }: { plan: RatePlan; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function handleUpdate(fd: FormData) {
    setErr(null);
    startTransition(async () => {
      const res = await updateRatePlan(plan.id, fd);
      if (res.ok) { setEditing(false); onSaved(); }
      else setErr(res.error);
    });
  }

  async function handleDeactivate() {
    if (!window.confirm(`Deactivate "${plan.name}"? It won't appear in the check-in form.`)) return;
    setErr(null);
    startTransition(async () => {
      const res = await deactivateRatePlan(plan.id);
      if (res.ok) onSaved();
      else setErr(res.error);
    });
  }

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-stone-900">{plan.name}</p>
          <p className="text-xs text-stone-500">
            {peso(plan.base_rate)} base · {plan.base_hours}h · +{peso(plan.extra_hour_rate)}/h extra
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-amber-700 hover:underline">Edit</button>
          <button type="button" onClick={handleDeactivate} disabled={isPending} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50">Remove</button>
        </div>
        {err && <p className="col-span-full text-xs text-red-600">{err}</p>}
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-amber-300 bg-amber-50 p-3">
      <form action={handleUpdate} className="space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="sm:col-span-1">
            <label className={labelCls}>Name *</label>
            <input name="name" defaultValue={plan.name} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Base hours</label>
            <input name="base_hours" type="number" min="1" defaultValue={plan.base_hours} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Base rate ₱</label>
            <input name="base_rate" type="number" min="0" step="0.01" defaultValue={plan.base_rate} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Extra/h ₱</label>
            <input name="extra_hour_rate" type="number" min="0" step="0.01" defaultValue={plan.extra_hour_rate} className={inputCls} />
          </div>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={isPending} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
            {isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => { setEditing(false); setErr(null); }} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100">
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Promo row — view / inline-edit / deactivate
// ---------------------------------------------------------------------------
function PromoRow({ promo, onSaved }: { promo: Promo; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function handleUpdate(fd: FormData) {
    setErr(null);
    startTransition(async () => {
      const res = await updatePromo(promo.id, fd);
      if (res.ok) { setEditing(false); onSaved(); }
      else setErr(res.error);
    });
  }

  async function handleDeactivate() {
    if (!window.confirm(`Remove promo "${promo.name}"?`)) return;
    setErr(null);
    startTransition(async () => {
      const res = await deactivatePromo(promo.id);
      if (res.ok) onSaved();
      else setErr(res.error);
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const isExpired = !!promo.valid_until && promo.valid_until < today;
  const notYetValid = !!promo.valid_from && promo.valid_from > today;

  if (!editing) {
    return (
      <li className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-stone-900">{promo.name}</p>
            {isExpired && (
              <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Expired</span>
            )}
            {notYetValid && !isExpired && (
              <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500">Upcoming</span>
            )}
          </div>
          <p className="text-xs text-stone-500">
            {promo.disc_type === "percent" ? `${promo.disc_value}% off` : `${peso(promo.disc_value)} off`}
            {promo.valid_from && <> · from {promo.valid_from}</>}
            {promo.valid_until && <> · until {promo.valid_until}</>}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-amber-700 hover:underline">Edit</button>
          <button type="button" onClick={handleDeactivate} disabled={isPending} className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50">Remove</button>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-amber-300 bg-amber-50 p-3">
      <form action={handleUpdate} className="space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="col-span-2">
            <label className={labelCls}>Name *</label>
            <input name="name" defaultValue={promo.name} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <select name="disc_type" defaultValue={promo.disc_type} className={inputCls}>
              <option value="percent">% off</option>
              <option value="amount">₱ off</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Value</label>
            <input name="disc_value" type="number" min="0" step="0.01" defaultValue={promo.disc_value} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Valid from (optional)</label>
            <input name="valid_from" type="date" defaultValue={promo.valid_from ?? ""} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Valid until (optional)</label>
            <input name="valid_until" type="date" defaultValue={promo.valid_until ?? ""} className={inputCls} />
          </div>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={isPending} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
            {isPending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => { setEditing(false); setErr(null); }} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100">
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main manager
// ---------------------------------------------------------------------------
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
  const refresh = () => router.refresh();

  const [planState, planAction, planPending] = useActionState<ActionResult | undefined, FormData>(createRatePlan, undefined);
  const [promoState, promoAction, promoPending] = useActionState<ActionResult | undefined, FormData>(createPromo, undefined);

  return (
    <div className="space-y-6">
      {/* Rate plans */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Rate plans</p>

        {ratePlans.length === 0 && <p className="mb-2 text-sm text-stone-400">No rate plans yet.</p>}
        <ul className="mb-4 space-y-2">
          {ratePlans.map((p) => (
            <RatePlanRow key={p.id} plan={p} onSaved={refresh} />
          ))}
        </ul>

        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Add new</p>
        <form action={planAction} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="sm:col-span-1">
            <label className={labelCls}>Name *</label>
            <input name="name" placeholder="e.g. Standard 3h" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Base hours</label>
            <input name="base_hours" type="number" placeholder="3" defaultValue="3" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Base rate ₱ *</label>
            <input name="base_rate" type="number" placeholder="500" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Extra/h ₱</label>
            <input name="extra_hour_rate" type="number" placeholder="150" defaultValue="0" className={inputCls} />
          </div>
          <button type="submit" disabled={planPending} className="col-span-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 sm:col-span-4">
            {planPending ? "Adding…" : "+ Add rate plan"}
          </button>
        </form>
        {planState && !planState.ok && <p className="mt-1 text-sm text-red-700">{planState.error}</p>}
      </div>

      {/* Promos */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Promos / discounts</p>

        {promos.length === 0 && <p className="mb-2 text-sm text-stone-400">No promos yet.</p>}
        <ul className="mb-4 space-y-2">
          {promos.map((p) => (
            <PromoRow key={p.id} promo={p} onSaved={refresh} />
          ))}
        </ul>

        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Add new</p>
        <form action={promoAction} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="col-span-2">
            <label className={labelCls}>Name *</label>
            <input name="name" placeholder="e.g. Senior citizen" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <select name="disc_type" defaultValue="percent" className={inputCls}>
              <option value="percent">% off</option>
              <option value="amount">₱ off</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Value</label>
            <input name="disc_value" type="number" placeholder="20" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Valid from (optional)</label>
            <input name="valid_from" type="date" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Valid until (optional)</label>
            <input name="valid_until" type="date" className={inputCls} />
          </div>
          <button type="submit" disabled={promoPending} className="col-span-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 sm:col-span-4">
            {promoPending ? "Adding…" : "+ Add promo"}
          </button>
        </form>
        {promoState && !promoState.ok && <p className="mt-1 text-sm text-red-700">{promoState.error}</p>}
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={onDone} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
          Close
        </button>
      </div>
    </div>
  );
}
