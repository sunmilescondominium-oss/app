"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { approveRequest, rejectRequest } from "@/app/(app)/authorizations/actions";
import { peso } from "@/lib/collections/summary";
import type { AuthRequest } from "@/lib/authorizations/types";

type ActionResult = { ok: true } | { ok: false; error: string };

const TYPE_LABEL: Record<string, string> = {
  collection_edit: "Collection edit",
  transmittal_revert: "Transmittal revert",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CollectionEditDetail({ payload }: { payload: Record<string, unknown> }) {
  const before = payload.before as Record<string, unknown> | undefined;
  const patch = payload.patch as Record<string, unknown> | undefined;
  if (!before || !patch) return null;
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-stone-200 bg-stone-50 p-2 text-xs">
      <div className="col-span-2 font-semibold text-stone-500 uppercase tracking-wide text-[10px] mb-1">Proposed change</div>
      {Number(patch.amount) !== Number(before.amount) ? <><div className="text-stone-400">Amount</div><div><span className="line-through text-stone-400">{peso(Number(before.amount))}</span> → <strong>{peso(Number(patch.amount))}</strong></div></> : null}
      {String(patch.business_line) !== String(before.business_line) ? <><div className="text-stone-400">Category</div><div><span className="line-through text-stone-400">{String(before.business_line)}</span> → <strong>{String(patch.business_line)}</strong></div></> : null}
      {String(patch.payment_type) !== String(before.payment_type) ? <><div className="text-stone-400">Payment</div><div><span className="line-through text-stone-400">{String(before.payment_type)}</span> → <strong>{String(patch.payment_type)}</strong></div></> : null}
      {String(patch.or_number) !== String(before.or_number) ? <><div className="text-stone-400">OR #</div><div><span className="line-through text-stone-400">{String(before.or_number ?? "—")}</span> → <strong>{String(patch.or_number ?? "—")}</strong></div></> : null}
      {payload.was_transmitted ? <div className="col-span-2 mt-1 rounded bg-amber-50 px-2 py-1 text-amber-800">⚠ This collection was already transmitted</div> : null}
    </div>
  );
}

function TransmittalRevertDetail({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 p-2 text-xs">
      <div className="font-semibold text-stone-500 uppercase tracking-wide text-[10px] mb-1">Transmittal to revert</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <div className="text-stone-400">Ref</div><div className="font-mono font-semibold">{String(payload.transmittal_ref ?? "—")}</div>
        <div className="text-stone-400">Date</div><div>{String(payload.transmittal_date ?? "—")}</div>
        <div className="text-stone-400">Status was</div><div className="capitalize">{String(payload.status_was ?? "—")}</div>
        <div className="text-stone-400">Amount</div><div className="font-semibold">{peso(Number(payload.total_amount ?? 0))}</div>
        <div className="text-stone-400">Collections</div><div>{String(payload.collection_count ?? "?")} entries will be freed</div>
      </div>
      {payload.status_was === "deposited" && (
        <div className="mt-1 rounded bg-red-50 px-2 py-1 text-red-800">⚠ Already deposited — bank transaction will be voided on approval</div>
      )}
    </div>
  );
}

function RequestCard({ req }: { req: AuthRequest }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [showReject, setShowReject] = useState(false);

  const approveBound = approveRequest.bind(null, req.id);
  const rejectBound = rejectRequest.bind(null, req.id);

  const [approveState, approveAction, approvePending] = useActionState<ActionResult | undefined, FormData>(approveBound, undefined);
  const [rejectState, rejectAction, rejectPending] = useActionState<ActionResult | undefined, FormData>(rejectBound, undefined);

  const done = approveState?.ok || rejectState?.ok;
  if (done) {
    router.refresh();
    return null;
  }

  const expiresAt = new Date(req.expires_at);
  const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 3600000));

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
            {TYPE_LABEL[req.type] ?? req.type}
          </span>
          <p className="mt-1 text-sm font-medium text-stone-900">{req.justification}</p>
          <p className="mt-0.5 text-xs text-stone-500">
            Requested by <strong>{req.requester_label}</strong> · {timeAgo(req.created_at)} · expires in {hoursLeft}h
          </p>
        </div>
      </div>

      {req.type === "collection_edit" && <CollectionEditDetail payload={req.payload} />}
      {req.type === "transmittal_revert" && <TransmittalRevertDetail payload={req.payload} />}

      {(approveState && !approveState.ok) && (
        <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{approveState.error}</p>
      )}
      {(rejectState && !rejectState.ok) && (
        <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700">{rejectState.error}</p>
      )}

      {showReject ? (
        <form action={rejectAction} className="mt-3 space-y-2">
          <input name="review_note" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for rejection (optional)" required
            className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200" />
          <div className="flex gap-2">
            <button type="submit" disabled={rejectPending}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">
              {rejectPending ? "Rejecting…" : "Confirm reject"}
            </button>
            <button type="button" onClick={() => setShowReject(false)}
              className="text-xs text-stone-500 hover:underline">Cancel</button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex gap-2">
          <form action={approveAction}>
            <input type="hidden" name="review_note" value="" />
            <button type="submit" disabled={approvePending}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {approvePending ? "Approving…" : "Approve"}
            </button>
          </form>
          <button type="button" onClick={() => setShowReject(true)}
            className="rounded-lg border border-red-300 px-4 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

export function PendingApprovals({ requests }: { requests: AuthRequest[] }) {
  if (requests.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-300 bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
          {requests.length}
        </span>
        <h2 className="text-base font-semibold text-stone-900">Pending approvals</h2>
        <span className="ml-auto text-xs text-stone-400">Expires within 48 h of request</span>
      </div>
      <div className="space-y-3">
        {requests.map((r) => <RequestCard key={r.id} req={r} />)}
      </div>
    </div>
  );
}
