"use client";

import { useTransition, useState } from "react";
import { activateReservation, markNoShow, cancelReservation } from "@/app/(app)/hotel/gift-cards/actions";
import type { GiftCardReservation } from "@/lib/gift-cards/types";

interface Props {
  reservation: GiftCardReservation;
  canWrite: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  checked_in: "bg-green-100 text-green-800",
  no_show: "bg-rose-100 text-rose-800",
  cancelled: "bg-stone-100 text-stone-500",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Manila" });
}

export function ReservationRow({ reservation: r, canWrite }: Props) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErr(null);
    const res = await fn();
    if (!res.ok) setErr(res.error ?? "Error");
  }

  return (
    <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-stone-800">
          {r.card_code ?? "—"} · {r.owner_label ?? "—"}
        </p>
        <p className="text-xs text-stone-500">
          {fmtTime(r.scheduled_at)} · {r.planned_hours}h
          {r.unit_number ? ` · Room ${r.unit_number}` : ""}
        </p>
        {err && <p className="text-xs text-rose-600">{err}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-stone-100 text-stone-500"}`}>
          {r.status.replace("_", "-")}
        </span>
        {r.status === "pending" && canWrite && (
          <>
            <button
              disabled={pending}
              onClick={() => startTransition(() => act(() => activateReservation(r.id)))}
              className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              Check in
            </button>
            <button
              disabled={pending}
              onClick={() => startTransition(() => act(() => markNoShow(r.id)))}
              className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
            >
              No-show
            </button>
            <button
              disabled={pending}
              onClick={() => startTransition(() => act(() => cancelReservation(r.id)))}
              className="rounded-lg border border-stone-200 px-3 py-1 text-xs text-stone-500 hover:bg-stone-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
