"use client";

import { useTransition, useState } from "react";
import { approveLoadRequest, rejectLoadRequest } from "@/app/(app)/hotel/gift-cards/actions";
import type { GiftCardLoadRequest } from "@/lib/gift-cards/types";

interface Props {
  request: GiftCardLoadRequest & { card_code: string; owner_label: string };
  canApprove: boolean;
}

function fmtCcy(n: number) {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
}

export function LoadRequestRow({ request: r, canApprove }: Props) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  async function approve() {
    setErr(null);
    const res = await approveLoadRequest(r.id);
    if (!res.ok) setErr(res.error ?? "Error");
  }

  async function reject() {
    setErr(null);
    const fd = new FormData();
    fd.set("review_note", note);
    const res = await rejectLoadRequest(r.id, undefined, fd);
    if (!res.ok) setErr(res.error ?? "Error");
    else setRejecting(false);
  }

  return (
    <div className="px-5 py-3 space-y-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-800">{r.card_code} · {r.owner_label}</p>
          <p className="text-xs text-stone-600">
            {r.hours_requested}h · {fmtCcy(r.amount_paid)} via {r.payment_method}
            {r.reference_no ? ` · Ref: ${r.reference_no}` : ""}
          </p>
          {r.notes && <p className="text-xs text-stone-400 italic">{r.notes}</p>}
          {err && <p className="text-xs text-rose-600">{err}</p>}
        </div>
        {r.status === "pending" && canApprove && (
          <div className="flex gap-2">
            <button
              disabled={pending}
              onClick={() => startTransition(() => approve())}
              className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              Approve
            </button>
            <button
              disabled={pending}
              onClick={() => setRejecting(true)}
              className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
            >
              Reject
            </button>
          </div>
        )}
      </div>
      {rejecting && (
        <div className="flex items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 rounded-lg border border-stone-200 px-3 py-1 text-xs"
          />
          <button
            disabled={pending}
            onClick={() => startTransition(() => reject())}
            className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            Confirm
          </button>
          <button onClick={() => setRejecting(false)} className="text-xs text-stone-400 hover:underline">Cancel</button>
        </div>
      )}
    </div>
  );
}
