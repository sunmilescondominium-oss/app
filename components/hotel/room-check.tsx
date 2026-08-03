"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { issueRoomCheck, type ActionResult } from "@/app/(app)/hotel/actions";
import { ROOM_ASSET_CHECKLIST } from "@/lib/config";
import { Modal } from "@/components/modal";

const inputCls =
  "w-20 rounded-lg border border-stone-300 px-2 py-1 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function RoomCheck({ stayId, gatepassNo }: { stayId: string; gatepassNo: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(
    issueRoomCheck.bind(null, stayId),
    undefined,
  );

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="no-print rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-700">Room check & gate pass</p>
        {gatepassNo ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            Gate pass {gatepassNo}
          </span>
        ) : (
          <span className="text-xs text-stone-400">not issued</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
      >
        {gatepassNo ? "Re-check room" : "Check room & issue gate pass"}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Room asset check">
        <form action={action} className="space-y-3">
          <p className="text-xs text-stone-500">Verify counts before releasing the gate pass.</p>
          {ROOM_ASSET_CHECKLIST.map((a) => (
            <div key={a.key} className="flex items-center justify-between">
              <label className="text-sm">
                {a.label} <span className="text-xs text-stone-400">(exp {a.expected})</span>
              </label>
              <input name={`asset_${a.key}`} type="number" min={0} defaultValue={a.expected} className={inputCls} />
            </div>
          ))}
          <textarea
            name="notes"
            placeholder="Damages / missing items…"
            rows={2}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
          {state && !state.ok && <p className="text-sm text-red-700">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
              {pending ? "Saving…" : "Issue gate pass"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
