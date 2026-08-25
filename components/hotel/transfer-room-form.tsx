"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transferRoom } from "@/app/(app)/hotel/actions";

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

const PRESET_REASONS = [
  { value: "room_issue", label: "Room issue (AC, water, plumbing, etc.)" },
  { value: "maintenance", label: "Requires maintenance / repair" },
  { value: "guest_preference", label: "Guest preference" },
  { value: "other", label: "Other" },
] as const;

export function TransferRoomForm({
  stayId,
  checkInAt,
  availableRooms,
  onDone,
}: {
  stayId: string;
  checkInAt: string;
  availableRooms: { id: string; unit_number: string }[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState<string>("room_issue");
  const [remarks, setRemarks] = useState("");
  const [toUnitId, setToUnitId] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const elapsedMin = Math.floor((Date.now() - new Date(checkInAt).getTime()) / 60000);
  const within10 = elapsedMin <= 10;

  function submit() {
    setErr("");
    if (!toUnitId) { setErr("Select a room to transfer to."); return; }
    const fd = new FormData();
    fd.set("to_unit_id", toUnitId);
    fd.set("transfer_reason", reason);
    fd.set("remarks", remarks);
    start(async () => {
      const res = await transferRoom(stayId, fd);
      if (!res.ok) { setErr(res.error); return; }
      router.push(`/hotel/${res.newStayId}`);
      onDone();
    });
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-lg px-4 py-3 text-sm ${within10 ? "border border-emerald-300 bg-emerald-50 text-emerald-900" : "border border-amber-200 bg-amber-50 text-amber-900"}`}>
        {within10
          ? `Guest checked in ${elapsedMin} min ago — timer will RESET on transfer (within 10-minute window).`
          : `Guest checked in ${elapsedMin} min ago — timer will add 5 minutes (after 10-minute window).`}
      </div>

      <div>
        <label className={labelCls}>Transfer to room *</label>
        <select value={toUnitId} onChange={(e) => setToUnitId(e.target.value)} className={inputCls}>
          <option value="">— select room —</option>
          {availableRooms.map((r) => (
            <option key={r.id} value={r.id}>{r.unit_number}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>Reason for transfer *</label>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
          {PRESET_REASONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>Remarks / details (required for audit)</label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          placeholder="Describe the issue or reason in detail — this is reviewed by admin and monitoring"
          className={inputCls}
        />
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !toUnitId}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {pending ? "Transferring…" : "Confirm transfer"}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">
          Cancel
        </button>
      </div>
    </div>
  );
}
