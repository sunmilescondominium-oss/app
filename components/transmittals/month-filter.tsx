"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function TransmittalMonthFilter({ current }: { current: string }) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value; // "YYYY-MM" or ""
    const sp = new URLSearchParams(params.toString());
    if (val) sp.set("month", val); else sp.delete("month");
    router.push(`/transmittals?${sp.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-xs font-medium text-stone-600">Filter by month</label>
      <input
        type="month"
        defaultValue={current}
        onChange={onChange}
        className="rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
      />
      {current && (
        <button
          type="button"
          onClick={() => { const sp = new URLSearchParams(params.toString()); sp.delete("month"); router.push(`/transmittals?${sp.toString()}`); }}
          className="text-xs text-stone-500 hover:text-stone-700 hover:underline"
        >
          Show all
        </button>
      )}
    </div>
  );
}
