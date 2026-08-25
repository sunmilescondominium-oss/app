"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { voidStay, deleteExtension } from "@/app/(app)/hotel/actions";
import type { StayExtension } from "@/lib/hotel/types";

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function DeleteExtensionRow({
  ext,
  stayId,
}: {
  ext: StayExtension;
  stayId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  function confirm() {
    setErr("");
    start(async () => {
      const res = await deleteExtension(ext.id, stayId, reason);
      if (!res.ok) { setErr(res.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-700">
          <span className="font-semibold">+{ext.added_hours}h</span> extension added {fmt(ext.created_at)}
        </span>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md border border-rose-300 px-2 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
          >
            Delete extension
          </button>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <label className="block text-xs font-medium text-stone-600">
            Reason for deleting this extension (required for audit)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Extension was logged in error; guest did not actually extend"
            className={inputCls}
          />
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={pending || !reason.trim()}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {pending ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SupervisorOpsPanel({
  stayId,
  extensions,
}: {
  stayId: string;
  extensions: StayExtension[];
}) {
  const router = useRouter();
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidErr, setVoidErr] = useState("");
  const [pending, start] = useTransition();

  function confirmVoid() {
    setVoidErr("");
    start(async () => {
      const res = await voidStay(stayId, voidReason);
      if (!res.ok) { setVoidErr(res.error); return; }
      router.push("/hotel");
    });
  }

  return (
    <div className="no-print rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
        Supervisor operations
      </p>

      {/* Extension management */}
      {extensions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-stone-600">Extensions recorded on this stay</p>
          {extensions.map((ext) => (
            <DeleteExtensionRow key={ext.id} ext={ext} stayId={stayId} />
          ))}
        </div>
      )}

      {/* Void / cancel check-in */}
      <div>
        {!voidOpen ? (
          <button
            type="button"
            onClick={() => setVoidOpen(true)}
            className="rounded-lg border border-rose-400 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
          >
            Void / cancel check-in
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-rose-800">
              Void this check-in? The stay will be cancelled and the room flagged for housekeeping.
            </p>
            <p className="text-xs text-rose-700">
              Payments already collected will remain in the system for accounting review. This action cannot be undone.
            </p>
            <label className="block text-xs font-medium text-stone-600">
              Reason for voiding (required — logged for audit)
            </label>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              rows={3}
              placeholder="e.g. Check-in was entered for wrong room; guest left before room was assigned"
              className={inputCls}
            />
            {voidErr && <p className="text-xs text-red-600">{voidErr}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmVoid}
                disabled={pending || !voidReason.trim()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {pending ? "Voiding…" : "Confirm void"}
              </button>
              <button
                type="button"
                onClick={() => setVoidOpen(false)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
