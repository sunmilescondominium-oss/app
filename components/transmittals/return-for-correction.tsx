"use client";

import { useState, useTransition } from "react";
import { returnForCorrection } from "@/app/(app)/transmittals/actions";
import { useRouter } from "next/navigation";

export function ReturnForCorrection({
  transmittalId,
  canReturn,
  alreadyReturned,
  returnReason,
  returnedByRole,
  returnedAt,
}: {
  transmittalId: string;
  canReturn: boolean;
  alreadyReturned: boolean;
  returnReason?: string | null;
  returnedByRole?: string | null;
  returnedAt?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function roleLabel(r: string | null | undefined) {
    if (!r) return "—";
    return r.charAt(0).toUpperCase() + r.slice(1).replace(/_/g, " ");
  }

  function handleReturn() {
    if (!reason.trim()) { setError("Please enter a reason."); return; }
    setError("");
    startTransition(async () => {
      const res = await returnForCorrection(transmittalId, reason);
      if (res.ok) {
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (alreadyReturned) {
    return (
      <div className="rounded-xl border border-rose-300 bg-rose-50 p-4">
        <p className="text-sm font-semibold text-rose-800">⚠ Returned for correction</p>
        <p className="mt-1 text-xs text-rose-700">
          Returned by <strong>{roleLabel(returnedByRole)}</strong>
          {returnedAt && <> on {new Date(returnedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</>}
        </p>
        {returnReason && (
          <p className="mt-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs text-rose-800">
            <span className="font-medium">Reason:</span> {returnReason}
          </p>
        )}
        <p className="mt-2 text-xs text-rose-600">
          The errand liaison must re-submit the liaison count with a correction note explaining the error.
        </p>
      </div>
    );
  }

  if (!canReturn) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
      >
        ↩ Return for correction
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-stone-900">Return for correction</h3>
            <p className="mt-1 text-sm text-stone-500">
              This will roll back the custody chain to <strong>Liaison count</strong> and notify the errand liaison to re-enter their count with an explanation.
            </p>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold text-stone-700">
                Reason for returning <span className="text-rose-500">*</span>
              </label>
              <p className="mb-1.5 text-[10px] text-stone-400">This is shown to the liaison and recorded in the audit log.</p>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Liaison count of ₱40,730 does not match monitoring recount of ₱39,830. Please correct the count and explain the variance."
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
              />
            </div>

            {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setOpen(false); setReason(""); setError(""); }}
                disabled={pending}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReturn}
                disabled={pending || !reason.trim()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {pending ? "Returning…" : "Return for correction"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
