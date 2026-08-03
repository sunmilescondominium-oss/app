"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { PaymentForm } from "./payment-form";
import { BuyerForm } from "./buyer-form";
import { regenerateSOA, setBuyerStatus } from "@/app/(app)/buyers/actions";
import { BUYER_STATUSES } from "@/lib/config";
import type { Buyer } from "@/lib/buyers/types";
import type { UnitOption } from "@/lib/collections/types";

export function BuyerDetailActions({
  buyer,
  unitOptions,
  canWrite,
}: {
  buyer: Buyer;
  unitOptions: UnitOption[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"pay" | "edit" | null>(null);
  const [busy, setBusy] = useState(false);

  const done = () => {
    setModal(null);
    router.refresh();
  };

  async function regen() {
    setBusy(true);
    const r = await regenerateSOA(buyer.id);
    setBusy(false);
    if (!r.ok) {
      window.alert(r.error);
      return;
    }
    router.refresh();
  }

  async function changeStatus(e: ChangeEvent<HTMLSelectElement>) {
    const r = await setBuyerStatus(buyer.id, e.target.value);
    if (!r.ok) {
      window.alert(r.error);
      return;
    }
    router.refresh();
  }

  if (!canWrite) return null;

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setModal("pay")}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
      >
        + Record payment
      </button>
      <button
        type="button"
        onClick={regen}
        disabled={busy}
        className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
      >
        {busy ? "Recomputing…" : "Regenerate SOA"}
      </button>
      <button
        type="button"
        onClick={() => setModal("edit")}
        className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
      >
        Edit buyer
      </button>
      <label className="ml-1 flex items-center gap-1 text-xs text-stone-500">
        Status
        <select
          defaultValue={buyer.payment_status}
          onChange={changeStatus}
          className="rounded-lg border border-stone-300 px-2 py-1 text-sm outline-none focus:border-amber-500"
        >
          {BUYER_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <Modal open={modal === "pay"} onClose={() => setModal(null)} title="Record payment">
        <PaymentForm buyerId={buyer.id} onDone={done} />
      </Modal>
      <Modal open={modal === "edit"} onClose={() => setModal(null)} title="Edit buyer">
        <BuyerForm mode="edit" buyer={buyer} unitOptions={unitOptions} onDone={done} />
      </Modal>
    </div>
  );
}
