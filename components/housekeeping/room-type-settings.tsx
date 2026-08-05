"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateRoomType, createRoomType, type ActionResult } from "@/app/(app)/housekeeping/actions";
import type { RoomTypeConfig } from "@/lib/housekeeping/types";
import { t, type Lang } from "@/lib/i18n";

const inputCls =
  "rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

type Item = { key: string; label: string };

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `item_${Date.now()}`;
}

function RoomTypeRow({ rt, lang }: { rt: RoomTypeConfig; lang: Lang }) {
  const router = useRouter();
  const tr = (k: string) => t(lang, k);
  const [buffer, setBuffer] = useState(String(rt.buffer_minutes));
  const [cleaning, setCleaning] = useState(String(rt.cleaning_minutes));
  const [items, setItems] = useState<Item[]>(rt.checklist);
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function addItem() {
    const label = newItem.trim();
    if (!label) return;
    setItems((x) => [...x, { key: slug(label), label }]);
    setNewItem("");
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await updateRoomType(rt.id, { buffer_minutes: Number(buffer), cleaning_minutes: Number(cleaning), checklist: items });
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }
    setMsg(tr("hk_saved"));
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-800">{rt.label}</p>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-stone-500">{rt.business_line}{rt.unit_type ? ` · ${rt.unit_type}` : ""}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <label className="text-xs font-medium text-stone-600">
          {tr("hk_buffer_min")}
          <input type="number" min={0} value={buffer} onChange={(e) => setBuffer(e.target.value)} className={`${inputCls} mt-1 block w-24`} />
        </label>
        <label className="text-xs font-medium text-stone-600">
          {tr("hk_clean_min")}
          <input type="number" min={1} value={cleaning} onChange={(e) => setCleaning(e.target.value)} className={`${inputCls} mt-1 block w-24`} />
        </label>
      </div>

      <p className="mt-3 mb-1 text-xs font-medium text-stone-600">{tr("hk_checklist")}</p>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={`${it.key}-${i}`} className="flex items-center gap-2">
            <input
              value={it.label}
              onChange={(e) => setItems((x) => x.map((v, j) => (j === i ? { ...v, label: e.target.value } : v)))}
              className={`${inputCls} flex-1`}
            />
            <button type="button" onClick={() => setItems((x) => x.filter((_, j) => j !== i))} className="text-xs text-red-600 hover:underline">{tr("hk_remove")}</button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={tr("hk_new_task")} className={`${inputCls} flex-1`} />
          <button type="button" onClick={addItem} disabled={!newItem.trim()} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50">+ {tr("hk_add_item")}</button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">{tr("hk_save")}</button>
        {msg && <span className="text-xs text-stone-500">{msg}</span>}
      </div>
    </div>
  );
}

export function RoomTypeSettings({ roomTypes, lang = "en" }: { roomTypes: RoomTypeConfig[]; lang?: Lang }) {
  const router = useRouter();
  const tr = (k: string) => t(lang, k);
  const [addState, addAction, addPending] = useActionState<ActionResult | undefined, FormData>(createRoomType, undefined);
  useEffect(() => { if (addState?.ok) router.refresh(); }, [addState, router]);

  return (
    <div className="mt-8">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-stone-500">{tr("hk_room_types")}</h2>
      <p className="mb-3 text-xs text-stone-400">{tr("hk_room_types_hint")}</p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {roomTypes.map((rt) => (
          <RoomTypeRow key={rt.id} rt={rt} lang={lang} />
        ))}
      </div>

      <form action={addAction} className="mt-4 flex flex-wrap items-end gap-2">
        <select name="business_line" defaultValue="hotel" className={inputCls} aria-label="Business line">
          <option value="hotel">hotel</option>
          <option value="airbnb">airbnb</option>
        </select>
        <input name="unit_type" placeholder={tr("hk_unit_type")} className={inputCls} />
        <input name="label" placeholder={tr("hk_label")} className={inputCls} />
        <button type="submit" disabled={addPending} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60">+ {tr("hk_add_room_type")}</button>
        {addState && !addState.ok && <p className="w-full text-sm text-red-700">{addState.error}</p>}
      </form>
    </div>
  );
}
