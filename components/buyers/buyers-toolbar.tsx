"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { BuyerForm } from "./buyer-form";
import { ParamsEditor } from "./params-editor";
import type { UnitOption } from "@/lib/collections/types";
import type { ComputationParam } from "@/lib/buyers/types";

export function BuyersToolbar({
  unitOptions,
  params,
  canWrite,
  canManageParams,
}: {
  unitOptions: UnitOption[];
  params: ComputationParam[];
  canWrite: boolean;
  canManageParams: boolean;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<"add" | "params" | null>(null);
  const done = () => {
    setModal(null);
    router.refresh();
  };

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {canWrite && (
        <button
          type="button"
          onClick={() => setModal("add")}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          + Add buyer
        </button>
      )}
      {canManageParams && (
        <button
          type="button"
          onClick={() => setModal("params")}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          Computation settings
        </button>
      )}

      <Modal open={modal === "add"} onClose={() => setModal(null)} title="Add buyer">
        <BuyerForm mode="create" unitOptions={unitOptions} onDone={done} />
      </Modal>
      <Modal
        open={modal === "params"}
        onClose={() => setModal(null)}
        title="Computation parameters"
      >
        <ParamsEditor params={params} onDone={done} />
      </Modal>
    </div>
  );
}
