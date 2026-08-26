"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transferRoom } from "@/app/(app)/hotel/actions";
import { HOTEL_PAYMENT_METHODS } from "@/lib/config";

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

const PRESET_REASONS = [
  { value: "room_issue", label: "Room issue (AC, water, plumbing, etc.)" },
  { value: "maintenance", label: "Requires maintenance / repair" },
  { value: "guest_preference", label: "Guest preference" },
  { value: "other", label: "Other" },
] as const;

const MAINTENANCE_REASONS = new Set(["room_issue", "maintenance"]);

export function TransferRoomForm({
  stayId,
  checkInAt,
  availableRooms,
  currentBaseRate,
  onDone,
}: {
  stayId: string;
  checkInAt: string;
  availableRooms: { id: string; unit_number: string }[];
  currentBaseRate: number;
  onDone: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState<string>("room_issue");
  const [remarks, setRemarks] = useState("");
  const [maintenanceDescription, setMaintenanceDescription] = useState("");
  const [toUnitId, setToUnitId] = useState("");
  const [newRateStr, setNewRateStr] = useState(String(currentBaseRate));
  const [upgradeMethod, setUpgradeMethod] = useState("");
  const [upgradeArNo, setUpgradeArNo] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const elapsedMin = Math.floor((Date.now() - new Date(checkInAt).getTime()) / 60000);
  const within10 = elapsedMin <= 10;
  const needsMaintDesc = MAINTENANCE_REASONS.has(reason);
  const newRate = parseFloat(newRateStr) || currentBaseRate;
  const shortfall = Math.max(0, Math.round((newRate - currentBaseRate) * 100) / 100);
  const hasUpgradeFee = shortfall > 0;

  function submit() {
    setErr("");
    if (!toUnitId) { setErr("Select a room to transfer to."); return; }
    if (needsMaintDesc && !maintenanceDescription.trim()) {
      setErr("Please describe the room issue so a maintenance request can be created.");
      return;
    }
    if (hasUpgradeFee && !upgradeMethod) {
      setErr("Select a payment method for the upgrade fee.");
      return;
    }
    const fd = new FormData();
    fd.set("to_unit_id", toUnitId);
    fd.set("transfer_reason", reason);
    fd.set("remarks", remarks);
    fd.set("maintenance_description", maintenanceDescription.trim());
    fd.set("new_base_rate", String(newRate));
    fd.set("upgrade_amount", String(shortfall));
    fd.set("upgrade_method", upgradeMethod);
    fd.set("upgrade_ar_no", upgradeArNo.trim());
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
        <select value={reason} onChange={(e) => { setReason(e.target.value); setMaintenanceDescription(""); }} className={inputCls}>
          {PRESET_REASONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {needsMaintDesc && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <label className="mb-1 block text-xs font-semibold text-rose-900">
            Room issue / maintenance description * <span className="font-normal">(creates a maintenance request)</span>
          </label>
          <textarea
            value={maintenanceDescription}
            onChange={(e) => setMaintenanceDescription(e.target.value)}
            rows={3}
            placeholder="e.g. AC not cooling, water leak from ceiling, faulty door lock…"
            className={inputCls}
          />
        </div>
      )}

      <div>
        <label className={labelCls}>Additional remarks (optional)</label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={2}
          placeholder="Any other notes for audit purposes"
          className={inputCls}
        />
      </div>

      {/* Room rate & upgrade fee */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
        <p className="text-xs font-semibold text-amber-900">Room rate for new room</p>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className={labelCls}>Current room rate (₱)</label>
            <input type="text" readOnly value={currentBaseRate.toFixed(2)} className={`${inputCls} bg-stone-100 text-stone-500`} />
          </div>
          <div className="flex-1">
            <label className={labelCls}>New room rate (₱) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={newRateStr}
              onChange={(e) => { setNewRateStr(e.target.value); setUpgradeMethod(""); }}
              className={inputCls}
            />
          </div>
        </div>
        {shortfall > 0 ? (
          <div className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm">
            <p className="font-semibold text-amber-900">
              Upgrade shortfall: <span className="text-rose-700">₱{shortfall.toFixed(2)}</span>
            </p>
            <p className="text-xs text-stone-500 mt-0.5">
              ₱{currentBaseRate.toFixed(2)} already collected · ₱{shortfall.toFixed(2)} to collect now
            </p>
          </div>
        ) : newRate < currentBaseRate ? (
          <p className="text-xs text-stone-500">New rate is lower — no additional collection needed.</p>
        ) : (
          <p className="text-xs text-stone-500">Same rate — no additional collection needed.</p>
        )}
        {hasUpgradeFee && (
          <>
            <div>
              <label className={labelCls}>Payment method for upgrade fee *</label>
              <select value={upgradeMethod} onChange={(e) => setUpgradeMethod(e.target.value)} className={inputCls}>
                <option value="">— select —</option>
                {HOTEL_PAYMENT_METHODS.map((m) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>AR / OR No. (optional)</label>
              <input
                type="text"
                value={upgradeArNo}
                onChange={(e) => setUpgradeArNo(e.target.value)}
                placeholder="e.g. OR-2025-0042"
                className={inputCls}
              />
            </div>
          </>
        )}
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
