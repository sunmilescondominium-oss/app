"use client";

import { useState } from "react";
import { Modal } from "@/components/modal";
import { TransferRoomForm } from "./transfer-room-form";

export function TransferRoomModal({
  stayId,
  checkInAt,
  availableRooms,
  currentBaseRate,
}: {
  stayId: string;
  checkInAt: string;
  availableRooms: { id: string; unit_number: string }[];
  currentBaseRate: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 no-print"
      >
        Transfer to another room
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Room transfer">
        <TransferRoomForm
          stayId={stayId}
          checkInAt={checkInAt}
          availableRooms={availableRooms}
          currentBaseRate={currentBaseRate}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
