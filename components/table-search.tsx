"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Instant client-side search/filter for any table. Wrap a `.table-wrap` (or any
 * element containing a <table>) — it hides tbody rows whose text doesn't match.
 * Data-row detection skips the "no records" colspan row.
 */
export function TableSearch({ placeholder = "Search…", children }: { placeholder?: string; children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [count, setCount] = useState<{ shown: number; total: number } | null>(null);

  useEffect(() => {
    const rows = wrapRef.current?.querySelectorAll<HTMLElement>("tbody tr") ?? [];
    const term = q.trim().toLowerCase();
    let shown = 0;
    let total = 0;
    rows.forEach((row) => {
      // Skip placeholder rows (single cell spanning the table).
      if (row.querySelectorAll("td").length <= 1) return;
      total += 1;
      const match = !term || (row.textContent ?? "").toLowerCase().includes(term);
      row.hidden = !match;
      if (match) shown += 1;
    });
    setCount(term ? { shown, total } : null);
  }, [q, children]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone-400">🔍</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-stone-300 bg-white py-2 pl-9 pr-8 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear" className="absolute inset-y-0 right-2 flex items-center text-stone-400 hover:text-stone-600">
              ✕
            </button>
          )}
        </div>
        {count && <span className="text-xs text-stone-400">{count.shown} of {count.total}</span>}
      </div>
      <div ref={wrapRef}>{children}</div>
    </div>
  );
}
