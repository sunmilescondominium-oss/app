"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustPaymentAR } from "@/app/(app)/hotel/actions";

export function EditPaymentArButton({
  paymentId,
  arNo,
  orNo,
}: {
  paymentId: string;
  arNo: string | null;
  orNo: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [newAr, setNewAr] = useState(arNo ?? "");
  const [newOr, setNewOr] = useState(orNo ?? "");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!reason.trim()) { setErr("Reason is required."); return; }
    setErr("");
    startTransition(async () => {
      const r = await adjustPaymentAR(paymentId, newAr, newOr, reason);
      if (!r.ok) { setErr(r.error); return; }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-1 text-[10px] text-amber-600 hover:underline no-print"
      >
        Edit AR/OR
      </button>
    );
  }

  return (
    <div className="no-print mt-1 space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2">
      <div className="flex gap-1.5">
        <div className="flex-1">
          <label className="mb-0.5 block text-[10px] font-medium text-stone-500">AR No</label>
          <input
            value={newAr}
            onChange={(e) => setNewAr(e.target.value)}
            placeholder="e.g. AR 205567"
            className="w-full rounded border border-stone-300 px-2 py-1 text-xs outline-none focus:border-amber-400"
          />
        </div>
        <div className="flex-1">
          <label className="mb-0.5 block text-[10px] font-medium text-stone-500">OR No</label>
          <input
            value={newOr}
            onChange={(e) => setNewOr(e.target.value)}
            placeholder="e.g. 205580"
            className="w-full rounded border border-stone-300 px-2 py-1 text-xs outline-none focus:border-amber-400"
          />
        </div>
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for correction (required)"
        className="w-full rounded border border-stone-300 px-2 py-1 text-xs outline-none focus:border-amber-400"
      />
      {err && <p className="text-[10px] text-red-600">{err}</p>}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setErr(""); setReason(""); }}
          className="rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 hover:bg-stone-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
