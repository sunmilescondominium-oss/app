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

export function DemoModeBar({ actingAs }: { actingAs: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  function handleEndDemo() {
    setErr("");
    start(async () => {
      // 1. Wipe all demo data (HK tasks + stays + reset rooms)
      const res = await clearDemoData();
      if (!res.ok) { setErr(res.error); return; }
      // 2. Clear the demo mode cookie
      await setDemoMode(false);
      router.refresh();
    });
  }

  return (
    <div className="no-print mb-4 rounded-xl border-2 border-purple-400 bg-purple-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold text-purple-900">🎭 Demo Mode Active</span>
          {actingAs && (
            <span className="rounded-full border border-purple-300 bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
              Acting as: {ROLE_LABELS[actingAs] ?? actingAs}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleEndDemo}
          disabled={pending}
          className="rounded-lg border border-rose-500 bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
        >
          {pending ? "Ending demo…" : "🛑 End Demo"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-purple-700">
        All activity uses ghost demo rooms (DEMO-101, 201, 301) and is isolated from real hotel data.
        Click <strong>End Demo</strong> to wipe all demo records and return to normal mode.
      </p>
      {err && <p className="mt-1 text-xs font-medium text-red-600">{err}</p>}
    </div>
  );
}
