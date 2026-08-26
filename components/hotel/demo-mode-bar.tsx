"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDemoMode } from "@/lib/auth/actions";
import { clearDemoData } from "@/app/(app)/hotel/actions";

const ROLE_LABELS: Record<string, string> = {
  consultant: "Consultant",
  admin: "Admin",
  managing_officer: "Managing Officer",
  hotel_rental_monitoring: "Hotel & Rental Monitoring",
  hotel_cashier: "Hotel Cashier",
  room_attendant: "Room Attendant",
  accounting: "Accounting",
  operations_manager: "Operations Manager",
  guard: "Guard",
  owner: "Owner",
};

export function DemoModeBar({
  actingAs,
}: {
  actingAs: string | null;
}) {
  const router = useRouter();
  const [clearing, startClear] = useTransition();
  const [exiting, startExit] = useTransition();
  const [clearDone, setClearDone] = useState(false);
  const [err, setErr] = useState("");

  function handleClear() {
    setErr(""); setClearDone(false);
    startClear(async () => {
      const res = await clearDemoData();
      if (!res.ok) { setErr(res.error); return; }
      setClearDone(true);
      router.refresh();
    });
  }

  function handleExitDemo() {
    startExit(async () => {
      await setDemoMode(false);
      router.refresh();
    });
  }

  return (
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-purple-400 bg-purple-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-base font-bold text-purple-900">🎭 Demo Mode Active</span>
        {actingAs && (
          <span className="rounded-full border border-purple-300 bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
            Viewing as: {ROLE_LABELS[actingAs] ?? actingAs}
          </span>
        )}
        <span className="text-xs text-purple-700">New check-ins are tagged as demo data.</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {clearDone && <span className="text-xs text-emerald-700">✓ Demo data cleared</span>}
        {err && <span className="text-xs text-red-600">{err}</span>}
        <button
          type="button"
          onClick={handleClear}
          disabled={clearing}
          className="rounded-lg border border-rose-400 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
        >
          {clearing ? "Clearing…" : "Clear demo data"}
        </button>
        <button
          type="button"
          onClick={handleExitDemo}
          disabled={exiting}
          className="rounded-lg border border-purple-400 bg-white px-3 py-1.5 text-xs font-semibold text-purple-800 hover:bg-purple-100 disabled:opacity-60"
        >
          {exiting ? "…" : "Exit demo mode"}
        </button>
      </div>
    </div>
  );
}
