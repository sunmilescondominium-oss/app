"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { roomCharge } from "@/lib/hotel/rates";
import { peso } from "@/lib/collections/summary";
import type { RoomBoardItem } from "@/lib/hotel/types";

function fmt(ms: number): string {
  const s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

export function RoomCard({
  item,
  canWrite,
  onCheckIn,
}: {
  item: RoomBoardItem;
  canWrite: boolean;
  onCheckIn: (unit: RoomBoardItem["unit"]) => void;
}) {
  const { unit, stay, needsHousekeeping } = item;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!stay) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [stay]);

  if (!stay) {
    const forHousekeeping = needsHousekeeping;
    return (
      <div className={`rounded-2xl border-2 p-4 ${forHousekeeping ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"}`}>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-stone-900">{unit.unit_number}</p>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${forHousekeeping ? "bg-amber-200 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>
            {forHousekeeping ? "For Housekeeping" : "Vacant"}
          </span>
        </div>
        <p className="mt-1 text-xs text-stone-500">{unit.unit_type ?? "Room"}</p>
        {forHousekeeping ? (
          <p className="mt-3 text-xs text-amber-700">Not available until housekeeping marks it ready.</p>
        ) : (
          canWrite && (
            <button
              type="button"
              onClick={() => onCheckIn(unit)}
              className="mt-3 w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Check in
            </button>
          )
        )}
      </div>
    );
  }

  const outMs = new Date(stay.check_in_at).getTime() + stay.planned_hours * 3600000;
  const rem = outMs - now;

  // Live billing: if the guest stays past checkout WITHOUT an extension, bill the
  // overtime automatically (per started hour at the extension rate).
  const elapsedH = (now - new Date(stay.check_in_at).getTime()) / 3_600_000;
  const effHours = Math.max(stay.planned_hours, Math.ceil(elapsedH));
  const overtimeHours = effHours - stay.planned_hours;
  const liveCharge = roomCharge(stay.base_rate, stay.extra_hour_rate, stay.base_hours, effHours);
  const paid = item.paid ?? 0;
  const ordersTotal = item.ordersTotal ?? 0;
  const liveTotal = Math.max(0, liveCharge - Math.min(liveCharge, stay.discount_amount) + ordersTotal);
  const liveBalance = Math.max(0, Math.round((liveTotal - paid) * 100) / 100);

  const checkoutRequested = Boolean(stay.checkout_requested);

  return (
    <div
      className={`rounded-2xl border-2 p-4 ${
        checkoutRequested ? "border-rose-500 bg-rose-100 animate-pulse" : rem < 0 ? "border-red-300 bg-red-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="font-semibold text-stone-900">{unit.unit_number}</p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${checkoutRequested ? "bg-rose-600 text-white" : "bg-amber-200 text-amber-900"}`}>
          {checkoutRequested ? "🔔 Check-out" : "Occupied"}
        </span>
      </div>
      <p className="mt-1 truncate text-sm text-stone-700">{stay.guest_label}</p>
      {stay.rate_plan_name && <p className="text-xs text-amber-700">{stay.rate_plan_name}</p>}
      <p className={`mt-2 text-lg font-bold tabular-nums ${rem < 0 ? "text-red-700" : "text-stone-900"}`}>
        {rem >= 0 ? `${fmt(rem)} left` : `OVER +${fmt(rem)}`}
      </p>
      <p className="text-xs text-stone-500">
        {stay.planned_hours}h · {peso(liveTotal)} · +{peso(stay.extra_hour_rate)}/hr ext
      </p>
      {overtimeHours > 0 && (
        <p className="mt-0.5 text-[11px] font-semibold text-rose-600">Overtime +{overtimeHours}h auto-billed</p>
      )}
      <p className={`mt-1 text-sm font-semibold tabular-nums ${liveBalance > 0 ? "text-red-700" : "text-emerald-700"}`}>
        {liveBalance > 0 ? `Balance: ${peso(liveBalance)}` : "Paid ✓"}
        {ordersTotal ? <span className="ml-1 text-[11px] font-normal text-stone-400">(incl. {peso(ordersTotal)} orders)</span> : null}
      </p>
      <Link
        href={`/hotel/${stay.id}`}
        className="mt-3 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-center text-sm font-medium text-stone-700 hover:bg-stone-100"
      >
        Open folio
      </Link>
    </div>
  );
}
