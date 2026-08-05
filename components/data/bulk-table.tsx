"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { BulkResult } from "@/lib/data/bulk";

export type BulkColumn = { header: string; align?: "left" | "right" };
export type BulkRow = { id: string; cells: ReactNode[] };

/**
 * Reusable data table with row checkboxes + a bulk action bar (deactivate /
 * permanent delete). The parent renders the cells; this handles selection,
 * confirmation, and calling the server actions. FK-referenced rows are reported
 * as skipped by the delete action.
 */
export function BulkTable({
  columns,
  rows,
  minWidth = "760px",
  canWrite,
  canHardDelete,
  deactivate,
  hardDelete,
  deactivateLabel = "Deactivate",
  entityLabel = "record(s)",
  emptyText = "No records.",
}: {
  columns: BulkColumn[];
  rows: BulkRow[];
  minWidth?: string;
  canWrite: boolean;
  canHardDelete: boolean;
  deactivate?: (ids: string[]) => Promise<BulkResult>;
  hardDelete: (ids: string[]) => Promise<BulkResult>;
  deactivateLabel?: string;
  entityLabel?: string;
  emptyText?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => (rows.every((r) => s.has(r.id)) ? new Set() : new Set(rows.map((r) => r.id))));

  async function runDeactivate() {
    if (!deactivate) return;
    setBusy(true);
    const res = await deactivate([...selected]);
    setBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    setSelected(new Set());
    router.refresh();
  }

  async function runDelete() {
    if (!window.confirm(`Permanently delete ${selected.size} ${entityLabel}? This cannot be undone. Rows linked to other records are skipped.`)) return;
    setBusy(true);
    const res = await hardDelete([...selected]);
    setBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    window.alert(res.skipped.length ? `Deleted ${res.affected}. Skipped ${res.skipped.length} (linked to other records — deactivate those instead).` : `Deleted ${res.affected} ${entityLabel}.`);
    setSelected(new Set());
    router.refresh();
  }

  const span = columns.length + (canWrite ? 1 : 0);

  return (
    <div>
      {canWrite && selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          <span className="font-medium text-amber-900">{selected.size} selected</span>
          {deactivate && <button type="button" onClick={runDeactivate} disabled={busy} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50">{deactivateLabel}</button>}
          {canHardDelete && <button type="button" onClick={runDelete} disabled={busy} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Delete permanently</button>}
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-stone-500 hover:underline">Clear</button>
        </div>
      )}

      <div className="table-wrap">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              {canWrite && <th className="px-3 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" className="h-4 w-4 accent-amber-600" /></th>}
              {columns.map((c, i) => <th key={i} className={`px-4 py-3 ${c.align === "right" ? "text-right" : ""}`}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={span} className="px-4 py-8 text-center text-stone-500">{emptyText}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-stone-100 last:border-0">
                {canWrite && <td className="px-3 py-2.5"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label="Select row" className="h-4 w-4 accent-amber-600" /></td>}
                {r.cells.map((cell, i) => <td key={i} className={`px-4 py-2.5 ${columns[i]?.align === "right" ? "text-right tabular-nums" : ""}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
