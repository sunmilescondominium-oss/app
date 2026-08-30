"use client";

import { useTransition, useState } from "react";
import { peso } from "@/lib/collections/summary";
import type { DeletedCollection, DeletedTransmittal } from "@/lib/collections/queries";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "short",
    timeStyle: "short",
  });
}

// ── Deleted Collections ─────────────────────────────────────────────────────

type ColAction = (id: string) => Promise<{ ok: boolean; error?: string }>;

export function DeletedCollectionsPanel({
  items,
  canRestore,
  canPurge,
  onRestore,
  onPurge,
}: {
  items: DeletedCollection[];
  canRestore: boolean;
  canPurge: boolean;
  onRestore: ColAction;
  onPurge: ColAction;
}) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<string | null>(null);

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  function handleRestore(id: string) {
    startTransition(async () => {
      const res = await onRestore(id);
      if (res.ok) showToast("ok", "Record restored.");
      else showToast("err", res.error ?? "Restore failed.");
    });
  }

  function handlePurge(id: string) {
    setConfirmPurge(id);
  }

  function confirmPurgeAction() {
    if (!confirmPurge) return;
    const id = confirmPurge;
    setConfirmPurge(null);
    startTransition(async () => {
      const res = await onPurge(id);
      if (res.ok) showToast("ok", "Record permanently purged.");
      else showToast("err", res.error ?? "Purge failed.");
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      {toast && (
        <div className={`mb-3 rounded-lg border px-4 py-2.5 text-sm font-medium ${
          toast.type === "ok"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {toast.type === "ok" ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}
      <details className="rounded-xl border border-red-200 bg-red-50">
        <summary className="cursor-pointer select-none px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 rounded-xl">
          Deleted collections ({items.length}) — audit trail
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-t border-red-200 bg-red-100 text-red-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Business line</th>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">OR #</th>
                <th className="px-4 py-2">Deleted at</th>
                {(canRestore || canPurge) && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {items.map((c) => (
                <tr key={c.id} className="bg-white hover:bg-red-50">
                  <td className="px-4 py-2 whitespace-nowrap">{c.collected_on}</td>
                  <td className="px-4 py-2 capitalize">{c.business_line.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2">
                    {c.unit ? `${c.unit.unit_number}${c.unit.property_name ? ` — ${c.unit.property_name}` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{peso(c.amount)}</td>
                  <td className="px-4 py-2">{c.or_number ?? "—"}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-stone-400">{fmt(c.deleted_at)}</td>
                  {(canRestore || canPurge) && (
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        {canRestore && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleRestore(c.id)}
                            className="rounded px-2 py-1 text-xs font-medium text-amber-700 border border-amber-300 hover:bg-amber-50 disabled:opacity-50"
                          >
                            Restore
                          </button>
                        )}
                        {canPurge && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handlePurge(c.id)}
                            className="rounded px-2 py-1 text-xs font-medium text-red-700 border border-red-300 hover:bg-red-100 disabled:opacity-50"
                          >
                            Purge
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Purge confirmation modal */}
      {confirmPurge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-6 shadow-xl">
            <p className="font-semibold text-red-700">Permanently purge this record?</p>
            <p className="mt-1 text-sm text-stone-500">This cannot be undone. The row will be removed from the database forever.</p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmPurge(null)}
                className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPurgeAction}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Purge permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Deleted Transmittals ────────────────────────────────────────────────────

type TxAction = (id: string) => Promise<{ ok: boolean; error?: string }>;

export function DeletedTransmittalsPanel({
  items,
  canRestore,
  canPurge,
  onRestore,
  onPurge,
}: {
  items: DeletedTransmittal[];
  canRestore: boolean;
  canPurge: boolean;
  onRestore: TxAction;
  onPurge: TxAction;
}) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<string | null>(null);

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  function handleRestore(id: string) {
    startTransition(async () => {
      const res = await onRestore(id);
      if (res.ok) showToast("ok", "Transmittal restored.");
      else showToast("err", res.error ?? "Restore failed.");
    });
  }

  function handlePurge(id: string) {
    setConfirmPurge(id);
  }

  function confirmPurgeAction() {
    if (!confirmPurge) return;
    const id = confirmPurge;
    setConfirmPurge(null);
    startTransition(async () => {
      const res = await onPurge(id);
      if (res.ok) showToast("ok", "Transmittal permanently purged.");
      else showToast("err", res.error ?? "Purge failed.");
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      {toast && (
        <div className={`mb-3 rounded-lg border px-4 py-2.5 text-sm font-medium ${
          toast.type === "ok"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          {toast.type === "ok" ? "✓ " : "✕ "}{toast.msg}
        </div>
      )}
      <details className="rounded-xl border border-red-200 bg-red-50">
        <summary className="cursor-pointer select-none px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 rounded-xl">
          Deleted transmittals ({items.length}) — audit trail
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-t border-red-200 bg-red-100 text-red-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Deleted at</th>
                {(canRestore || canPurge) && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {items.map((t) => (
                <tr key={t.id} className="bg-white hover:bg-red-50">
                  <td className="px-4 py-2 whitespace-nowrap">{t.transmittal_date}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{peso(t.total_amount)}</td>
                  <td className="px-4 py-2 capitalize">{t.status}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-stone-400">{fmt(t.deleted_at)}</td>
                  {(canRestore || canPurge) && (
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        {canRestore && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleRestore(t.id)}
                            className="rounded px-2 py-1 text-xs font-medium text-amber-700 border border-amber-300 hover:bg-amber-50 disabled:opacity-50"
                          >
                            Restore
                          </button>
                        )}
                        {canPurge && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handlePurge(t.id)}
                            className="rounded px-2 py-1 text-xs font-medium text-red-700 border border-red-300 hover:bg-red-100 disabled:opacity-50"
                          >
                            Purge
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {confirmPurge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-6 shadow-xl">
            <p className="font-semibold text-red-700">Permanently purge this transmittal?</p>
            <p className="mt-1 text-sm text-stone-500">This cannot be undone. The record will be removed from the database forever.</p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmPurge(null)}
                className="flex-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPurgeAction}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Purge permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
