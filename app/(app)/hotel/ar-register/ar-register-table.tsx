"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditARForm } from "./edit-ar-form";
import type { ARRegisterEntry } from "@/lib/hotel/ar-register";

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit",
  });
}

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash", gcash: "GCash", maya: "Maya", bank_transfer: "Bank",
};

function BreakdownPanel({ entry }: { entry: ARRegisterEntry }) {
  const bd = entry.breakdown;
  if (!bd) {
    return (
      <p className="py-2 text-xs text-stone-400 italic">
        No itemized breakdown — recorded before this feature was enabled.
      </p>
    );
  }
  return (
    <div className="space-y-0.5">
      {bd.lines.map((line, i) => (
        <div key={i} className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-stone-500">
            {line.label}
            {line.qty != null && line.unit_price != null && (
              <span className="ml-1 text-stone-400">({line.qty}×{peso(line.unit_price)})</span>
            )}
          </span>
          <span className={`tabular-nums font-medium ${line.amount < 0 ? "text-rose-600" : "text-stone-700"}`}>
            {line.amount < 0 ? `−${peso(Math.abs(line.amount))}` : peso(line.amount)}
          </span>
        </div>
      ))}
      <div className="flex justify-between border-t border-stone-200 pt-1 text-xs font-semibold text-stone-800">
        <span>Folio total</span>
        <span className="tabular-nums">{peso(bd.total)}</span>
      </div>
      <div className="flex justify-between text-xs text-stone-500">
        <span>Amount paid</span>
        <span className="tabular-nums font-medium">{peso(entry.amount)}</span>
      </div>
      {entry.amount < bd.total && (
        <p className="text-[10px] text-amber-700">
          Partial payment — balance ₱{(bd.total - entry.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </p>
      )}
    </div>
  );
}

function EntryCard({
  entry,
  canEdit,
  expanded,
  onToggle,
}: {
  entry: ARRegisterEntry;
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  return (
    <div className={`rounded-xl border bg-white ${entry.voidedAsTest ? "opacity-50" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-3 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-stone-400">{fmtTime(entry.paidAt)}</span>
              {entry.unitNumber && (
                <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-bold text-stone-700">
                  Rm {entry.unitNumber}
                </span>
              )}
              {entry.voidedAsTest && (
                <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] text-stone-500">TEST</span>
              )}
              {entry.edits.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">
                  Edited ×{entry.edits.length}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-sm font-medium text-stone-800">{entry.guestLabel}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-stone-500">
              <span>{METHOD_LABEL[entry.method] ?? entry.method}</span>
              {entry.arNo && <span className="font-mono">{entry.arNo}</span>}
              {entry.orNo && <span className="font-mono text-stone-400">{entry.orNo}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="tabular-nums font-bold text-stone-800">{peso(entry.amount)}</span>
            <span className="text-[10px] text-stone-400">{expanded ? "▲ hide" : "▼ details"}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 px-3 pb-3 pt-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">Itemized</p>
          <BreakdownPanel entry={entry} />

          {entry.edits.length > 0 && (
            <div className="mt-2 rounded-lg border border-stone-100 bg-stone-50 p-2">
              <p className="mb-1 text-[10px] font-semibold uppercase text-stone-400">Correction history</p>
              {entry.edits.map((ed, i) => (
                <p key={i} className="text-[10px] text-stone-500">
                  {new Date(ed.editedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "short", timeStyle: "short" })}
                  {" · AR: "}{ed.oldArNo ?? "—"} → {ed.newArNo ?? "—"}
                  {ed.oldOrNo !== ed.newOrNo && <>{" · OR: "}{ed.oldOrNo ?? "—"} → {ed.newOrNo ?? "—"}</>}
                  {" · "}{ed.reason}
                </p>
              ))}
            </div>
          )}

          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="mt-2 rounded bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-amber-100 hover:text-amber-700"
            >
              Edit AR / OR
            </button>
          )}
          {canEdit && editing && (
            <div className="mt-2">
              <EditARForm
                paymentId={entry.paymentId}
                currentArNo={entry.arNo}
                currentOrNo={entry.orNo}
                onDone={() => { setEditing(false); router.refresh(); }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ARRegisterTable({
  entries,
  canEdit,
}: {
  entries: ARRegisterEntry[];
  canEdit: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!entries.length) {
    return <p className="py-8 text-center text-sm text-stone-400">No payments recorded for this date.</p>;
  }

  const total = entries.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <EntryCard
          key={e.paymentId}
          entry={e}
          canEdit={canEdit}
          expanded={expandedId === e.paymentId}
          onToggle={() => setExpandedId(expandedId === e.paymentId ? null : e.paymentId)}
        />
      ))}
      <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5">
        <span className="text-sm font-semibold text-stone-600">Total collected</span>
        <span className="tabular-nums text-base font-bold text-stone-900">{peso(total)}</span>
      </div>
    </div>
  );
}
