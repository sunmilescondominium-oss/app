"use client";

import { useEffect, useState } from "react";

/** Big ticking Manila clock for the attendance kiosk. */
export function DigitalClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now
    ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(now)
    : "--:--:--";
  const date = now
    ? new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now)
    : "";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-6 py-4 text-center shadow-sm">
      <div className="font-mono text-4xl font-bold tabular-nums tracking-tight text-stone-900 sm:text-5xl">{time}</div>
      <div className="mt-1 text-sm text-stone-500">{date} · Manila</div>
    </div>
  );
}
