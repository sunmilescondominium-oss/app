"use client";

import { useActionState, useTransition } from "react";
import { createGiftCard } from "@/app/(app)/hotel/gift-cards/actions";
import type { ActionResult } from "@/app/(app)/hotel/gift-cards/actions";

export function CreateGiftCardForm() {
  const [state, formAction] = useActionState<ActionResult | undefined, FormData>(
    createGiftCard,
    undefined,
  );
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => startTransition(() => formAction(fd))}
      className="grid gap-4 sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-stone-600 mb-1">Card holder name *</label>
        <input name="owner_label" required className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="Juan Dela Cruz" />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Contact (optional)</label>
        <input name="owner_contact" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="09XX-XXX-XXXX" />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">PIN (4–8 digits) *</label>
        <input name="pin" required pattern="\d{4,8}" minLength={4} maxLength={8} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono" placeholder="1234" />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Total hours loaded *</label>
        <input name="total_hours" required type="number" min={1} step={0.5} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="30" />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Purchase price (₱)</label>
        <input name="purchase_price" type="number" min={0} step={0.01} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="3000" />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Max hours per stay</label>
        <input name="max_hours_per_stay" type="number" min={1} defaultValue={6} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Max extension hours per stay</label>
        <input name="max_extension_hours" type="number" min={0} max={4} defaultValue={2} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">No-show buffer (minutes)</label>
        <input name="buffer_minutes" type="number" min={0} defaultValue={30} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Expires after (days)</label>
        <input name="expires_days" type="number" min={1} defaultValue={365} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-stone-600 mb-1">Notes (optional)</label>
        <input name="notes" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="e.g. Birthday promo" />
      </div>

      {state && !state.ok && (
        <p className="sm:col-span-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}
      {state?.ok && (
        <p className="sm:col-span-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">Gift card created successfully. Hand the card code and PIN to the customer.</p>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Sell gift card"}
        </button>
      </div>
    </form>
  );
}
