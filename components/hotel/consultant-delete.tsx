"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStay, deleteStayPayment } from "@/app/(app)/hotel/actions";

export function DeleteStayButton({ stayId }: { stayId: string }) {
  const [busy, start] = useTransition();
  const router = useRouter();

  function handle() {
    if (!window.confirm("PERMANENTLY delete this entire stay record (payments, orders, extensions)? This cannot be undone.")) return;
    start(async () => {
      const res = await deleteStay(stayId);
      if (!res.ok) { window.alert(res.error); return; }
      router.push("/hotel");
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
    >
      {busy ? "Deleting…" : "🗑 Delete stay"}
    </button>
  );
}

export function DeletePaymentButton({ paymentId, stayId, label }: { paymentId: string; stayId: string; label: string }) {
  const [busy, start] = useTransition();

  function handle() {
    if (!window.confirm(`Delete payment "${label}"? Cannot be undone.`)) return;
    start(async () => {
      const res = await deleteStayPayment(paymentId, stayId);
      if (!res.ok) window.alert(res.error);
    });
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      title="Delete payment (consultant only)"
      className="ml-1 rounded px-1 py-0.5 text-[10px] font-semibold text-rose-500 hover:bg-rose-50 disabled:opacity-50"
    >
      {busy ? "…" : "✕"}
    </button>
  );
}
