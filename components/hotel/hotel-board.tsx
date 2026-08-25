"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { RoomCard } from "./room-card";
import { CheckInForm } from "./check-in-form";
import { RatePromoManager } from "./rate-promo-manager";
import { MenuManager } from "./menu-manager";
import { TaxSettings } from "./tax-settings";
import { CheckoutAlarm } from "@/components/checkout-alarm";
import { OverdueAlarm } from "@/components/hotel/overdue-alarm";
import { saveUnitExtraPersonRate } from "@/app/(app)/hotel/actions";
import type { RoomBoardItem, RatePlan, Promo, MenuItem, TaxSetting, RoomTaxRow } from "@/lib/hotel/types";

type Unit = RoomBoardItem["unit"];
type ModalState = { kind: "checkin"; unit: Unit } | { kind: "config" } | null;

function UnitRateRow({ unit }: { unit: Unit }) {
  const router = useRouter();
  const [rate, setRate] = useState(String(unit.extra_person_rate));
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  function save() {
    setErr(""); setSaved(false);
    const v = Number(rate);
    if (!Number.isFinite(v) || v < 0) { setErr("Invalid amount"); return; }
    start(async () => {
      const res = await saveUnitExtraPersonRate(unit.id, v);
      if (!res.ok) { setErr(res.error); return; }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <tr className="border-b border-stone-100 last:border-0">
      <td className="py-2 pr-4 text-sm font-medium text-stone-700">{unit.unit_number}</td>
      <td className="py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-400">₱</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={rate}
            onChange={(e) => { setRate(e.target.value); setSaved(false); }}
            className="w-28 rounded-lg border border-stone-300 px-2 py-1 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {pending ? "…" : "Save"}
          </button>
          {saved && <span className="text-xs text-emerald-600">✓</span>}
        </div>
        {err && <p className="mt-0.5 text-xs text-red-600">{err}</p>}
      </td>
    </tr>
  );
}

function UnitExtraPersonRatesEditor({ units }: { units: Unit[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Extra person charge per room</p>
      <p className="mb-3 text-[11px] text-stone-400">Set 0 to disable for that room. Rate is charged per additional person at check-in and during the stay.</p>
      <table className="w-full">
        <thead>
          <tr className="border-b border-stone-200">
            <th className="pb-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">Room</th>
            <th className="pb-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">Rate / person</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => <UnitRateRow key={u.id} unit={u} />)}
        </tbody>
      </table>
    </div>
  );
}

export function HotelBoard({
  board,
  ratePlans,
  promos,
  menu,
  globalTax,
  roomTax,
  canWrite,
  canManageConfig,
  canManageTax,
  canManageExtraRates,
  suggestedArNo,
}: {
  board: RoomBoardItem[];
  ratePlans: RatePlan[];
  promos: Promo[];
  menu: MenuItem[];
  globalTax: TaxSetting;
  roomTax: RoomTaxRow[];
  canWrite: boolean;
  canManageConfig: boolean;
  canManageTax: boolean;
  canManageExtraRates: boolean;
  suggestedArNo?: string;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const done = () => {
    setModal(null);
    router.refresh();
  };
  const units = board.map((b) => b.unit);
  const pendingCheckouts = board.filter((b) => b.stay?.checkout_requested).length;
  const alarmStays = board
    .filter((b) => b.stay !== null && b.stay.status === "active")
    .map((b) => ({
      id: b.stay!.id,
      unit_number: b.unit.unit_number,
      guest_label: b.stay!.guest_label,
      check_in_at: b.stay!.check_in_at,
      planned_hours: b.stay!.planned_hours,
    }));

  return (
    <div>
      <CheckoutAlarm count={pendingCheckouts} />
      <OverdueAlarm stays={alarmStays} />
      {(canManageConfig || canManageTax || canManageExtraRates) && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setModal({ kind: "config" })}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            Settings (rates, menu, tax)
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {board.map((item) => (
          <RoomCard key={item.unit.id} item={item} canWrite={canWrite} onCheckIn={(unit) => setModal({ kind: "checkin", unit })} />
        ))}
      </div>

      <Modal
        open={modal?.kind === "checkin"}
        onClose={() => setModal(null)}
        title={modal?.kind === "checkin" ? `Check in — ${modal.unit.unit_number}` : "Check in"}
      >
        {modal?.kind === "checkin" && (
          <CheckInForm
            unitId={modal.unit.id}
            ratePlans={ratePlans}
            promos={promos}
            suggestedArNo={suggestedArNo}
            extraPersonRate={modal.unit.extra_person_rate}
            onDone={done}
          />
        )}
      </Modal>

      <Modal open={modal?.kind === "config"} onClose={() => setModal(null)} title="Hotel settings">
        <div className="space-y-8">
          {canManageConfig && (
            <>
              <RatePromoManager ratePlans={ratePlans} promos={promos} onDone={done} />
              <div className="border-t border-stone-200 pt-6">
                <MenuManager menu={menu} onDone={done} />
              </div>
            </>
          )}
          {canManageExtraRates && (
            <div className={canManageConfig ? "border-t border-stone-200 pt-6" : ""}>
              <UnitExtraPersonRatesEditor units={units} />
            </div>
          )}
          {canManageTax && (
            <div className="border-t border-stone-200 pt-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Tax</p>
              <TaxSettings global={globalTax} roomTax={roomTax} units={units} onDone={done} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
