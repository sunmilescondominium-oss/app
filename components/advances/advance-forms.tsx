"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  requestAdvance,
  cancelAdvance,
  decideAdvance,
  releaseAdvance,
  addLiquidation,
  closeLiquidation,
  type ActionResult,
} from "@/app/(app)/advances/actions";

const cls = "rounded-lg border border-stone-300 px-2.5 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function RequestAdvanceForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(requestAdvance, undefined);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-2xl border border-stone-200 bg-white p-4">
      <input name="amount" type="number" step="0.01" min="0" placeholder="Amount ₱" required className={`${cls} w-28`} />
      <input name="purpose" placeholder="Purpose" required className={`${cls} min-w-[12rem] flex-1`} />
      <input name="needed_by" type="date" className={cls} title="Needed by" />
      <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        {pending ? "Submitting…" : "Request advance"}
      </button>
      {state && !state.ok && <p className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

function useAct() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<ActionResult>) {
    setBusy(true);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return window.alert(r.error);
    router.refresh();
  }
  return { busy, run };
}

export function AdvanceRowActions({
  id,
  status,
  isOwner,
  canApprove,
  canRelease,
}: {
  id: string;
  status: string;
  isOwner: boolean;
  canApprove: boolean;
  canRelease: boolean;
}) {
  const { busy, run } = useAct();
  return (
    <div className="flex justify-end gap-2 text-xs font-medium">
      {isOwner && status === "pending" && (
        <button type="button" disabled={busy} onClick={() => run(() => cancelAdvance(id))} className="text-stone-500 hover:underline">cancel</button>
      )}
      {canApprove && status === "pending" && (
        <>
          <button type="button" disabled={busy} onClick={() => run(() => decideAdvance(id, "approved"))} className="text-emerald-700 hover:underline">approve</button>
          <button type="button" disabled={busy} onClick={() => run(() => decideAdvance(id, "rejected", window.prompt("Reason (optional):") || undefined))} className="text-rose-600 hover:underline">reject</button>
        </>
      )}
      {canRelease && status === "approved" && (
        <button type="button" disabled={busy} onClick={() => run(() => releaseAdvance(id))} className="text-sky-700 hover:underline">release funds</button>
      )}
    </div>
  );
}

export function LiquidationForm({ advanceId }: { advanceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function submit(formData: FormData) {
    setBusy(true);
    const r = await addLiquidation(advanceId, formData);
    setBusy(false);
    if (!r.ok) return window.alert(r.error);
    (document.getElementById(`liq-${advanceId}`) as HTMLFormElement)?.reset();
    router.refresh();
  }
  return (
    <form id={`liq-${advanceId}`} action={submit} className="flex flex-wrap items-end gap-2">
      <input name="description" placeholder="Expense description" required className={`${cls} min-w-[12rem] flex-1`} />
      <input name="amount" type="number" step="0.01" min="0" placeholder="Amount ₱" required className={`${cls} w-28`} />
      <input name="spent_on" type="date" className={cls} />
      <button type="submit" disabled={busy} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        {busy ? "Adding…" : "Add line"}
      </button>
    </form>
  );
}

export function CloseLiquidation({ advanceId }: { advanceId: string }) {
  const { busy, run } = useAct();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => { if (window.confirm("Close liquidation? This finalizes the advance.")) run(() => closeLiquidation(advanceId)); }}
      className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-900 disabled:opacity-60"
    >
      Close liquidation
    </button>
  );
}
