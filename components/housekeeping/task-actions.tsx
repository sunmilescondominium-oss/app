"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  startTask,
  completeTask,
  recordReplacements,
  turnoverTask,
  type ActionResult,
} from "@/app/(app)/housekeeping/actions";
import { HOUSEKEEPING_SHIFTS } from "@/lib/config";
import type { TaskDetail, HKChecklistItem } from "@/lib/housekeeping/types";
import { t, type Lang } from "@/lib/i18n";

const inputCls =
  "rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function TaskActions({
  detail,
  canWrite,
  lang = "en",
  replacedSupplyNames = [],
  hardStop = true,
  photoPanels,
}: {
  detail: TaskDetail;
  canWrite: boolean;
  lang?: Lang;
  /** Names of supplies already recorded as replaced on this task (from events). */
  replacedSupplyNames?: string[];
  /** When true, block completion until checklist done + standard materials recorded. */
  hardStop?: boolean;
  /** Cleaning + inspection photo panels — rendered before the final button. */
  photoPanels?: ReactNode;
}) {
  const router = useRouter();
  const tr = (k: string) => t(lang, k);
  const { task, supplies } = detail;

  const defaults = supplies.filter((s) => s.is_default);
  const others = supplies.filter((s) => !s.is_default);

  const [checklist, setChecklist] = useState<HKChecklistItem[]>(task.checklist);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [shift, setShift] = useState("morning");
  const [busy, setBusy] = useState(false);

  // Replace-materials selection.
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [qty, setQty] = useState<Record<string, string>>({});
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [pickOther, setPickOther] = useState("");
  const [replBusy, setReplBusy] = useState(false);
  const [replError, setReplError] = useState<string | null>(null);

  const [toState, toAction, toPending] = useActionState<ActionResult | undefined, FormData>(
    turnoverTask.bind(null, task.id),
    undefined,
  );

  useEffect(() => {
    if (toState?.ok) router.refresh();
  }, [toState, router]);

  if (!canWrite) return <div className="space-y-6">{photoPanels}</div>;

  async function start() {
    setBusy(true);
    const r = await startTask(task.id, shift);
    setBusy(false);
    if (!r.ok) {
      window.alert(r.error);
      return;
    }
    router.refresh();
  }

  function toggle(key: string) {
    setChecklist((cl) => cl.map((i) => (i.key === key ? { ...i, done: !i.done } : i)));
  }

  const getQty = (id: string) => Number(qty[id] ?? "1") || 1;
  // Translate a checklist item's task label; keep the stored label if unknown.
  const ckLabel = (item: HKChecklistItem) => {
    const key = `ck_${item.key}`;
    const out = tr(key);
    return out === key ? item.label : out;
  };

  function addOther() {
    if (!pickOther || extraIds.includes(pickOther)) {
      setPickOther("");
      return;
    }
    setExtraIds((x) => [...x, pickOther]);
    setPickOther("");
  }

  async function record() {
    const items = [
      ...defaults.filter((d) => checked[d.id]).map((d) => ({ supply_id: d.id, qty: getQty(d.id) })),
      ...extraIds.map((id) => ({ supply_id: id, qty: getQty(id) })),
    ];
    if (items.length === 0) {
      setReplError(tr("hk_reminder_materials").replace("• ", ""));
      return;
    }
    setReplBusy(true);
    setReplError(null);
    const r = await recordReplacements(task.id, items);
    setReplBusy(false);
    if (!r.ok) {
      setReplError(r.error);
      return;
    }
    setChecked({});
    setExtraIds([]);
    router.refresh();
  }

  async function complete() {
    // Reminder pop-out: checklist not done and/or standard materials not recorded.
    const checklistIncomplete = checklist.some((i) => !i.done);
    const standardMissing = defaults.some((d) => !replacedSupplyNames.includes(d.name));
    const warnings: string[] = [];
    if (checklistIncomplete) warnings.push(tr("hk_reminder_checklist"));
    if (standardMissing) warnings.push(tr("hk_reminder_materials"));
    if (warnings.length > 0) {
      if (hardStop) {
        // Hard stop — cannot complete until everything is done.
        window.alert(`${tr("hk_reminder_blocked")}\n\n${warnings.join("\n")}`);
        return;
      }
      const proceed = window.confirm(`${warnings.join("\n")}\n\n${tr("hk_reminder_proceed")}`);
      if (!proceed) return;
    }

    setBusy(true);
    const r = await completeTask(task.id, checklist, notes);
    setBusy(false);
    if (!r.ok) {
      window.alert(r.error);
      return;
    }
    router.refresh();
  }

  if (task.status === "done") {
    return (
      <div className="space-y-6">
        <p className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">✓ {tr("hk_cleaned_ready")}</p>
        {photoPanels}
      </div>
    );
  }

  if (task.status === "pending") {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-stone-200 bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">{tr("hk_shift")}</label>
            <select value={shift} onChange={(e) => setShift(e.target.value)} className={inputCls}>
              {HOUSEKEEPING_SHIFTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={start} disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
            {tr("hk_start_cleaning")}
          </button>
        </div>
        {photoPanels}
      </div>
    );
  }

  // in_progress
  return (
    <div className="space-y-5">
      {/* 1 · Cleaning checklist */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-stone-700">{tr("hk_checklist")}</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {checklist.map((i) => (
            <label key={i.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={i.done} onChange={() => toggle(i.key)} className="h-4 w-4 rounded border-stone-300" />
              {ckLabel(i)}
            </label>
          ))}
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tr("hk_notes_damages")} rows={2} className={`${inputCls} mt-3 w-full`} />
      </div>

      {/* 2 · Replace room material — standard checkboxes + other dropdown */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="text-sm font-semibold text-stone-700">{tr("hk_replace_material")}</p>
        <p className="mt-0.5 text-xs text-stone-500">{tr("hk_tick_replaced")}</p>

        {defaults.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            {defaults.map((d) => (
              <div key={d.id} className="flex items-center gap-2">
                <label className="flex flex-1 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!checked[d.id]}
                    onChange={(e) => setChecked((c) => ({ ...c, [d.id]: e.target.checked }))}
                    className="h-4 w-4 rounded border-stone-300"
                  />
                  <span>{d.name}</span>
                  <span className="text-xs text-stone-400">({d.stock_qty} {d.unit_label})</span>
                </label>
                {checked[d.id] && (
                  <input
                    type="number"
                    min={1}
                    value={qty[d.id] ?? "1"}
                    onChange={(e) => setQty((q) => ({ ...q, [d.id]: e.target.value }))}
                    aria-label={tr("hk_qty")}
                    className={`${inputCls} w-16`}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-stone-400">{tr("hk_no_defaults")}</p>
        )}

        {/* Extra (non-default) items added on the fly */}
        {extraIds.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-stone-100 pt-3">
            {extraIds.map((id) => {
              const s = others.find((o) => o.id === id);
              if (!s) return null;
              return (
                <div key={id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{s.name} <span className="text-xs text-stone-400">({s.stock_qty} {s.unit_label})</span></span>
                  <input
                    type="number"
                    min={1}
                    value={qty[id] ?? "1"}
                    onChange={(e) => setQty((q) => ({ ...q, [id]: e.target.value }))}
                    aria-label={tr("hk_qty")}
                    className={`${inputCls} w-16`}
                  />
                  <button type="button" onClick={() => setExtraIds((x) => x.filter((v) => v !== id))} className="text-xs text-red-600 hover:underline">
                    {tr("hk_remove")}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Other item picker */}
        {others.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
            <select value={pickOther} onChange={(e) => setPickOther(e.target.value)} className={inputCls}>
              <option value="">{tr("hk_other_item")}…</option>
              {others.filter((o) => !extraIds.includes(o.id)).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} (stock {o.stock_qty})
                </option>
              ))}
            </select>
            <button type="button" onClick={addOther} disabled={!pickOther} className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50">
              + {tr("hk_add_item")}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={record}
          disabled={replBusy}
          className="mt-3 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60"
        >
          {tr("hk_record")}
        </button>
        {replError && <p className="mt-2 text-sm text-red-700">{replError}</p>}
      </div>

      {/* 3 · Turn over to next shift */}
      <form action={toAction} className="flex flex-wrap items-end gap-2 rounded-2xl border border-stone-200 bg-white p-4">
        <p className="w-full text-sm font-semibold text-stone-700">{tr("hk_turn_over")}</p>
        <select name="to_shift" className={inputCls} defaultValue="afternoon">
          {HOUSEKEEPING_SHIFTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <input name="note" placeholder={tr("hk_whats_left")} className={`${inputCls} flex-1`} />
        <button type="submit" disabled={toPending} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60">
          {tr("hk_hand_over")}
        </button>
        {toState && !toState.ok && <p className="w-full text-sm text-red-700">{toState.error}</p>}
      </form>

      {/* 4 · Cleaning + inspection photos */}
      {photoPanels}

      {/* 5 · Mark room ready — final action */}
      <button type="button" onClick={complete} disabled={busy} className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
        {tr("hk_mark_ready")}
      </button>
    </div>
  );
}
