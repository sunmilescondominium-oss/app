"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startTask,
  completeTask,
  recordReplacement,
  turnoverTask,
  type ActionResult,
} from "@/app/(app)/housekeeping/actions";
import { HOUSEKEEPING_SHIFTS } from "@/lib/config";
import type { TaskDetail, HKChecklistItem } from "@/lib/housekeeping/types";
import { t, type Lang } from "@/lib/i18n";

const inputCls =
  "rounded-lg border border-stone-300 px-2 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function TaskActions({ detail, canWrite, lang = "en" }: { detail: TaskDetail; canWrite: boolean; lang?: Lang }) {
  const router = useRouter();
  const tr = (k: string) => t(lang, k);
  const { task, supplies } = detail;

  const [checklist, setChecklist] = useState<HKChecklistItem[]>(task.checklist);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [shift, setShift] = useState("morning");
  const [busy, setBusy] = useState(false);

  const [replState, replAction, replPending] = useActionState<ActionResult | undefined, FormData>(
    recordReplacement.bind(null, task.id),
    undefined,
  );
  const [toState, toAction, toPending] = useActionState<ActionResult | undefined, FormData>(
    turnoverTask.bind(null, task.id),
    undefined,
  );

  useEffect(() => {
    if (replState?.ok || toState?.ok) router.refresh();
  }, [replState, toState, router]);

  if (!canWrite) return null;

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

  async function complete() {
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
    return <p className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">✓ {tr("hk_cleaned_ready")}</p>;
  }

  return (
    <div className="space-y-5">
      {task.status === "pending" && (
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
      )}

      {task.status === "in_progress" && (
        <>
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="mb-2 text-sm font-semibold text-stone-700">{tr("hk_checklist")}</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {checklist.map((i) => (
                <label key={i.key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={i.done} onChange={() => toggle(i.key)} className="h-4 w-4 rounded border-stone-300" />
                  {i.label}
                </label>
              ))}
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tr("hk_notes_damages")} rows={2} className={`${inputCls} mt-3 w-full`} />
            <button type="button" onClick={complete} disabled={busy} className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {tr("hk_mark_ready")}
            </button>
          </div>

          <form action={replAction} className="flex flex-wrap items-end gap-2 rounded-2xl border border-stone-200 bg-white p-4">
            <p className="w-full text-sm font-semibold text-stone-700">{tr("hk_replace_material")}</p>
            <select name="supply_id" className={inputCls} defaultValue={supplies[0]?.id ?? ""}>
              {supplies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (stock {s.stock_qty})
                </option>
              ))}
            </select>
            <input name="qty" type="number" min={1} defaultValue={1} className={`${inputCls} w-20`} />
            <button type="submit" disabled={replPending} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60">
              {tr("hk_record")}
            </button>
            {replState && !replState.ok && <p className="w-full text-sm text-red-700">{replState.error}</p>}
          </form>

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
        </>
      )}
    </div>
  );
}
