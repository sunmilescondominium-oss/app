"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { RoomCard } from "./room-card";
import { CheckInForm } from "./check-in-form";
import { RatePromoManager } from "./rate-promo-manager";
import { MenuManager } from "./menu-manager";
import { TaxSettings } from "./tax-settings";
import type { RoomBoardItem, RatePlan, Promo, MenuItem, TaxSetting, RoomTaxRow } from "@/lib/hotel/types";

type Unit = RoomBoardItem["unit"];
type ModalState = { kind: "checkin"; unit: Unit } | { kind: "config" } | null;

export function HotelBoard({
  board,
  ratePlans,
  promos,
  menu,
  globalTax,
  roomTax,
  canWrite,
  isAdmin,
  canManageTax,
}: {
  board: RoomBoardItem[];
  ratePlans: RatePlan[];
  promos: Promo[];
  menu: MenuItem[];
  globalTax: TaxSetting;
  roomTax: RoomTaxRow[];
  canWrite: boolean;
  isAdmin: boolean;
  canManageTax: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const done = () => {
    setModal(null);
    router.refresh();
  };
  const units = board.map((b) => b.unit);

  return (
    <div>
      {(isAdmin || canManageTax) && (
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
          <CheckInForm unitId={modal.unit.id} ratePlans={ratePlans} promos={promos} onDone={done} />
        )}
      </Modal>

      <Modal open={modal?.kind === "config"} onClose={() => setModal(null)} title="Hotel settings">
        <div className="space-y-8">
          {isAdmin && (
            <>
              <RatePromoManager ratePlans={ratePlans} promos={promos} onDone={done} />
              <div className="border-t border-stone-200 pt-6">
                <MenuManager menu={menu} onDone={done} />
              </div>
            </>
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
