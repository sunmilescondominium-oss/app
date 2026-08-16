"use client";

import { useState, useTransition } from "react";
import { addItemType, updateItemType, toggleItemActive } from "@/app/(app)/admin/collection-items/actions";
import type { CollectionItemType } from "@/lib/collections/item-types-shared";
import { ITEM_GROUP_LABELS, ITEM_GROUPS, toItemKey } from "@/lib/collections/item-types-shared";

const inputCls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

const GRP_COLORS: Record<string, string> = {
  hotel:       "bg-sky-100 text-sky-800",
  rental:      "bg-emerald-100 text-emerald-800",
  airbnb:      "bg-pink-100 text-pink-800",
  condo_sales: "bg-violet-100 text-violet-800",
  parking:     "bg-amber-100 text-amber-800",
  utility:     "bg-orange-100 text-orange-800",
  other:       "bg-stone-100 text-stone-600",
};

export function CollectionItemManager({
  items: initItems,
}: {
  items: CollectionItemType[];
}) {
  const [items, setItems] = useState(initItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editGrp, setEditGrp] = useState("other");
  const [editSort, setEditSort] = useState(100);
  const [addLabel, setAddLabel] = useState("");
  const [addGrp, setAddGrp] = useState("other");
  const [addSort, setAddSort] = useState(100);
  const [err, setErr] = useState("");
  const [isPending, startTransition] = useTransition();

  const previewKey = toItemKey(addLabel);

  function startEdit(item: CollectionItemType) {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditGrp(item.grp);
    setEditSort(item.sort_order);
    setErr("");
  }

  function handleAdd() {
    if (!addLabel.trim()) { setErr("Label is required."); return; }
    setErr("");
    startTransition(async () => {
      const res = await addItemType(addLabel.trim(), addGrp, addSort);
      if (res.ok) {
        // Optimistic: reload via server revalidation — just reset form
        setAddLabel(""); setAddGrp("other"); setAddSort(100);
        // Refresh the list — server action revalidates the path so on next nav it's fresh;
        // for immediate UI we append optimistically
        const newKey = toItemKey(addLabel.trim());
        setItems((prev) => [
          ...prev,
          { id: newKey, key: newKey, label: addLabel.trim(), grp: addGrp, sort_order: addSort, is_active: true, is_system: false },
        ]);
      } else {
        setErr(res.error ?? "Failed.");
      }
    });
  }

  function handleUpdate() {
    if (!editingId || !editLabel.trim()) { setErr("Label is required."); return; }
    setErr("");
    startTransition(async () => {
      const res = await updateItemType(editingId, editLabel.trim(), editGrp, editSort);
      if (res.ok) {
        setItems((prev) => prev.map((t) =>
          t.id === editingId ? { ...t, label: editLabel.trim(), grp: editGrp, sort_order: editSort } : t,
        ));
        setEditingId(null);
      } else {
        setErr(res.error ?? "Failed.");
      }
    });
  }

  function handleToggle(id: string, current: boolean) {
    startTransition(async () => {
      const res = await toggleItemActive(id, !current);
      if (res.ok) {
        setItems((prev) => prev.map((t) => t.id === id ? { ...t, is_active: !current } : t));
      }
    });
  }

  const grouped = ITEM_GROUPS.map((g) => ({
    grp: g,
    label: ITEM_GROUP_LABELS[g],
    items: items.filter((t) => t.grp === g).sort((a, b) => a.sort_order - b.sort_order),
  })).filter((g) => g.items.length > 0);

  // Ungrouped items (unknown grp value)
  const knownGrps = new Set(ITEM_GROUPS);
  const ungrouped = items.filter((t) => !knownGrps.has(t.grp));

  return (
    <div className="space-y-6">
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      {/* ── Add new item ── */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
        <p className="mb-3 text-sm font-semibold text-stone-800">Add collection item</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className={labelCls}>Label *</label>
            <input
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
              placeholder="e.g. Pool Maintenance Fee"
              className={inputCls}
            />
            {addLabel && (
              <p className="mt-1 text-[10px] text-stone-400 font-mono">key: {previewKey}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Group</label>
            <select value={addGrp} onChange={(e) => setAddGrp(e.target.value)} className={inputCls}>
              {ITEM_GROUPS.map((g) => (
                <option key={g} value={g}>{ITEM_GROUP_LABELS[g]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Sort order</label>
            <input
              type="number"
              value={addSort}
              onChange={(e) => setAddSort(Number(e.target.value))}
              className={inputCls}
              min={0}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !addLabel.trim()}
          className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "+ Add item"}
        </button>
      </div>

      {/* ── Item list grouped ── */}
      {[...grouped, ...(ungrouped.length ? [{ grp: "_other", label: "Ungrouped", items: ungrouped }] : [])].map((section) => (
        <div key={section.grp} className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="border-b border-stone-100 bg-stone-50 px-4 py-2.5 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${GRP_COLORS[section.grp] ?? GRP_COLORS.other}`}>
              {section.label}
            </span>
            <span className="text-xs text-stone-400">{section.items.length} items</span>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-400">
              <tr>
                <th className="px-4 py-2 text-left">Label</th>
                <th className="px-4 py-2 text-left font-mono">Key</th>
                <th className="px-4 py-2 text-center">Sort</th>
                <th className="px-4 py-2 text-center">Active</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {section.items.map((item) => (
                <tr key={item.id} className={`border-b border-stone-50 last:border-0 ${!item.is_active ? "opacity-50" : ""}`}>
                  {editingId === item.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className={inputCls}
                          autoFocus
                        />
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-stone-400">{item.key}</td>
                      <td className="px-4 py-2">
                        <select value={editGrp} onChange={(e) => setEditGrp(e.target.value)} className={inputCls}>
                          {ITEM_GROUPS.map((g) => (
                            <option key={g} value={g}>{ITEM_GROUP_LABELS[g]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={editSort}
                          onChange={(e) => setEditSort(Number(e.target.value))}
                          className={inputCls}
                          min={0}
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button type="button" onClick={handleUpdate} disabled={isPending} className="mr-2 text-xs font-semibold text-amber-700 hover:underline disabled:opacity-60">Save</button>
                        <button type="button" onClick={() => setEditingId(null)} className="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 font-medium text-stone-800">{item.label}</td>
                      <td className="px-4 py-2 font-mono text-xs text-stone-400">{item.key}</td>
                      <td className="px-4 py-2 text-center text-xs text-stone-500">{item.sort_order}</td>
                      <td className="px-4 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(item.id, item.is_active)}
                          disabled={isPending}
                          title={item.is_active ? "Deactivate" : "Activate"}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${item.is_active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-stone-100 text-stone-500 hover:bg-stone-200"}`}
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button type="button" onClick={() => startEdit(item)} className="text-xs font-medium text-stone-500 hover:text-stone-800">
                          Edit
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
