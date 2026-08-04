"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  endorseRequisition, budgetReviewRequisition, ownerApproveRequisition,
  rejectRequisition, markPurchased, receiveRequisition,
} from "@/app/(app)/requisitions/actions";
import type { ReqStatus } from "@/lib/requisitions/queries";

type Caps = {
  canEndorse: boolean; canBudget: boolean; canOwner: boolean;
  canPurchase: boolean; canReceive: boolean; canReject: boolean;
};

export function WorkflowActions({ id, status, caps }: { id: string; status: ReqStatus; caps: Caps }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [supplier, setSupplier] = useState("");
  const [actual, setActual] = useState<number>(0);
  const [reason, setReason] = useState("");

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr(null); setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? "Failed."); return; }
    router.refresh();
  }

  const btn = "rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
  const done = status === "received" || status === "rejected" || status === "cancelled";

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="mb-3 font-semibold text-stone-800">Workflow</h3>

      {status === "submitted" && caps.canEndorse && (
        <button disabled={busy} onClick={() => run(() => endorseRequisition(id))} className={`${btn} bg-blue-600 hover:bg-blue-700`}>Endorse (Operations)</button>
      )}
      {status === "budget_review" && caps.canBudget && (
        <button disabled={busy} onClick={() => run(() => budgetReviewRequisition(id))} className={`${btn} bg-amber-600 hover:bg-amber-700`}>Pass budget review (Accounting)</button>
      )}
      {status === "owner_review" && caps.canOwner && (
        <button disabled={busy} onClick={() => run(() => ownerApproveRequisition(id))} className={`${btn} bg-emerald-600 hover:bg-emerald-700`}>Owner: give final approval</button>
      )}

      {status === "approved" && caps.canPurchase && (
        <div className="space-y-2">
          <p className="text-sm text-stone-600">Record the purchase:</p>
          <div className="flex flex-wrap gap-2">
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier" className="rounded-lg border border-stone-300 px-3 py-2 text-sm" />
            <input type="number" min={0} value={actual} onChange={(e) => setActual(Number(e.target.value))} placeholder="Actual total" className="w-36 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
            <button disabled={busy} onClick={() => run(() => markPurchased(id, supplier, actual))} className={`${btn} bg-indigo-600 hover:bg-indigo-700`}>Mark purchased</button>
          </div>
        </div>
      )}

      {status === "purchased" && caps.canReceive && (
        <button disabled={busy} onClick={() => run(() => receiveRequisition(id))} className={`${btn} bg-emerald-600 hover:bg-emerald-700`}>Receive goods (updates stock)</button>
      )}

      {!done && caps.canReject && ["submitted", "endorsed", "budget_review", "owner_review"].includes(status) && (
        <div className="mt-3 border-t border-stone-100 pt-3">
          <div className="flex flex-wrap gap-2">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejection" className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
            <button disabled={busy} onClick={() => run(() => rejectRequisition(id, reason))} className={`${btn} bg-red-600 hover:bg-red-700`}>Reject</button>
          </div>
        </div>
      )}

      {done && <p className="text-sm text-stone-500">This requisition is closed ({status}).</p>}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}
