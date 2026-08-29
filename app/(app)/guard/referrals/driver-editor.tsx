"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReferralDriver, updateReferralDriver, setDriverStatus } from "./actions";
import type { ReferralDriver } from "@/lib/guard/referral-queries";

const VEHICLE_TYPES = ["tricycle", "car", "van", "motorcycle", "other"];
const STATUS_LABEL: Record<string, string> = { active: "Active", suspended: "Suspended", inactive: "Inactive" };
const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  suspended: "bg-amber-100 text-amber-700",
  inactive: "bg-stone-100 text-stone-500",
};

const inputCls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function DriverForm({
  driver,
  onClose,
}: {
  driver?: ReferralDriver;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(driver?.name ?? "");
  const [plate, setPlate] = useState(driver?.plateNumber ?? "");
  const [vehicleType, setVehicleType] = useState(driver?.vehicleType ?? "tricycle");
  const [contact, setContact] = useState(driver?.contact ?? "");
  const [notes, setNotes] = useState(driver?.notes ?? "");
  const [error, setError] = useState("");
  const [busy, start] = useTransition();

  function save() {
    setError("");
    start(async () => {
      const fields = { name, plateNumber: plate, vehicleType, contact, notes };
      const result = driver
        ? await updateReferralDriver(driver.id, fields)
        : await createReferralDriver(fields);
      if (!result.ok) { setError(result.error); return; }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-sm font-bold text-stone-900">
          {driver ? `Edit — ${driver.name}` : "Add accredited driver"}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Driver name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Juan dela Cruz" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Plate number</label>
            <input type="text" value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="e.g. ABC 1234" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Vehicle type</label>
            <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={inputCls}>
              {VEHICLE_TYPES.map((v) => (
                <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Contact (optional)</label>
            <input type="text" value={contact} onChange={(e) => setContact(e.target.value)}
              placeholder="e.g. 09XX XXX XXXX" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Notes (optional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. regular hotel tricycle" className={inputCls} />
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={save} disabled={busy}
            className="flex-1 rounded-lg bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-900 disabled:opacity-60">
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onClose}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddDriverButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-900">
        + Add driver
      </button>
      {open && <DriverForm onClose={() => setOpen(false)} />}
    </>
  );
}

export function DriverRow({ driver, canManage }: { driver: ReferralDriver; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, start] = useTransition();

  function cycleStatus() {
    const next: Record<string, "active" | "suspended" | "inactive"> = {
      active: "suspended",
      suspended: "active",
      inactive: "active",
    };
    start(async () => {
      await setDriverStatus(driver.id, next[driver.status]);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-stone-800">{driver.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[driver.status]}`}>
              {STATUS_LABEL[driver.status]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-stone-500">
            {driver.plateNumber} · {driver.vehicleType}
            {driver.contact ? ` · ${driver.contact}` : ""}
          </p>
          {driver.notes && <p className="mt-0.5 text-[11px] text-stone-400">{driver.notes}</p>}
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={cycleStatus} disabled={busy}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50">
              {driver.status === "active" ? "Suspend" : "Activate"}
            </button>
            <button type="button" onClick={() => setEditing(true)}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
              Edit
            </button>
          </div>
        )}
      </div>
      {editing && <DriverForm driver={driver} onClose={() => setEditing(false)} />}
    </>
  );
}
