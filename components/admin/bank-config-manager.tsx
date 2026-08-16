"use client";

import { useState, useTransition } from "react";
import { updateBankConfig } from "@/app/(app)/admin/bank-config/actions";
import type { BankDepositConfig } from "@/lib/collections/bank-config";
import { BILLING_ITEM_TYPES } from "@/lib/config";

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

const ITEM_LABEL = Object.fromEntries(BILLING_ITEM_TYPES.map((t) => [t.key, t.label]));

export function BankConfigManager({ configs }: { configs: BankDepositConfig[] }) {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [bankName, setBankName] = useState("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [customItem, setCustomItem] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  const [isPending, startTransition] = useTransition();

  function startEdit(cfg: BankDepositConfig) {
    setEditingCategory(cfg.category);
    setBankName(cfg.bank_name);
    setSelectedItems([...cfg.items]);
    setNotes(cfg.notes ?? "");
    setErr("");
  }

  function toggleItem(key: string) {
    setSelectedItems((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function addCustomItem() {
    const trimmed = customItem.trim();
    if (!trimmed || selectedItems.includes(trimmed)) return;
    setSelectedItems((prev) => [...prev, trimmed]);
    setCustomItem("");
  }

  function removeItem(key: string) {
    setSelectedItems((prev) => prev.filter((k) => k !== key));
  }

  function save() {
    if (!editingCategory) return;
    if (!bankName.trim()) { setErr("Bank name is required."); return; }
    setErr("");
    startTransition(async () => {
      const res = await updateBankConfig(editingCategory, bankName.trim(), selectedItems, notes.trim() || null);
      if (res.ok) {
        setEditingCategory(null);
      } else {
        setErr(res.error ?? "Failed to save.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {configs.map((cfg) => (
        <div key={cfg.category} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          {editingCategory === cfg.category ? (
            /* ── Edit panel ── */
            <div className="p-4 space-y-4">
              <p className="text-sm font-semibold text-stone-800 capitalize">
                {cfg.category.replace(/_/g, " ")}
              </p>

              <div>
                <label className={labelCls}>Bank name *</label>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. China Bank, BDO, PNB"
                />
              </div>

              <div>
                <label className={labelCls}>Default collection items</label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {BILLING_ITEM_TYPES.map((t) => (
                    <label key={t.key} className="flex items-center gap-2 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-stone-50">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(t.key)}
                        onChange={() => toggleItem(t.key)}
                        className="h-3.5 w-3.5 accent-amber-600"
                      />
                      {t.label}
                    </label>
                  ))}
                </div>

                {/* Custom items (keys not in BILLING_ITEM_TYPES) */}
                {selectedItems.filter((k) => !BILLING_ITEM_TYPES.find((t) => t.key === k)).map((k) => (
                  <div key={k} className="mt-1.5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs">
                    <span className="flex-1 font-mono text-amber-800">{k}</span>
                    <button type="button" onClick={() => removeItem(k)} className="text-red-500 hover:text-red-700">×</button>
                  </div>
                ))}

                {/* Add custom item */}
                <div className="mt-2 flex gap-2">
                  <input
                    value={customItem}
                    onChange={(e) => setCustomItem(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomItem())}
                    placeholder="Add custom item key…"
                    className="flex-1 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={addCustomItem}
                    className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-200"
                  >
                    + Add
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>Notes (optional)</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. H01–H35 residential rental units"
                />
              </div>

              {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={isPending}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  {isPending ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* ── Display row ── */
            <div className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-stone-800 capitalize">
                    {cfg.category.replace(/_/g, " ")}
                  </span>
                  <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">
                    🏦 {cfg.bank_name}
                  </span>
                </div>
                {cfg.notes && (
                  <p className="mt-0.5 text-xs text-stone-400">{cfg.notes}</p>
                )}
                {cfg.items.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {cfg.items.map((k) => (
                      <span key={k} className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-600">
                        {ITEM_LABEL[k] ?? k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => startEdit(cfg)}
                className="shrink-0 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
