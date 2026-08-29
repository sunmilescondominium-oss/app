"use client";

import { useActionState, useTransition, useState } from "react";
import {
  startShift,
  endShiftWithHandover,
  acknowledgeHandover,
} from "@/app/(app)/guard/actions";
import type { GuardPost, GuardShift, HandoverReport } from "@/lib/guard/queries";

const inputCls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function fmtManila(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function LastHandoverCard({
  report,
  onAcknowledge,
}: {
  report: HandoverReport;
  onAcknowledge: () => void;
}) {
  const [busy, start] = useTransition();

  if (report.acknowledgedAt) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-500">
        <p className="mb-1 font-semibold text-stone-600">Last handover from {report.outgoingGuardLabel}</p>
        {report.incidentsNotes && <p className="mb-0.5"><span className="font-medium">Incidents:</span> {report.incidentsNotes}</p>}
        {report.pendingItems && <p><span className="font-medium">Pending:</span> {report.pendingItems}</p>}
        <p className="mt-1 text-stone-400">Acknowledged {fmtManila(report.acknowledgedAt)}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="mb-1 text-sm font-semibold text-amber-900">
        Handover from {report.outgoingGuardLabel} — please acknowledge
      </p>
      {report.incidentsNotes && (
        <p className="mb-1 text-xs text-amber-800">
          <span className="font-medium">Incidents/observations:</span> {report.incidentsNotes}
        </p>
      )}
      {report.pendingItems && (
        <p className="mb-2 text-xs text-amber-800">
          <span className="font-medium">Pending items:</span> {report.pendingItems}
        </p>
      )}
      {!report.incidentsNotes && !report.pendingItems && (
        <p className="mb-2 text-xs text-amber-700">No specific incidents noted.</p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => start(async () => {
          await acknowledgeHandover(report.id);
          onAcknowledge();
        })}
        className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {busy ? "…" : "I've read this — Acknowledge"}
      </button>
    </div>
  );
}

function HandoverForm({
  shift,
  onDone,
}: {
  shift: GuardShift;
  onDone: () => void;
}) {
  const [incidents, setIncidents] = useState("");
  const [pending, setPending] = useState("");
  const [busy, start] = useTransition();
  const [error, setError] = useState("");

  function submit() {
    setError("");
    start(async () => {
      const result = await endShiftWithHandover(
        shift.id,
        shift.postId,
        shift.shiftType,
        incidents,
        pending,
      );
      if (!result.ok) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="mt-3 space-y-2 border-t border-emerald-200 pt-3">
      <p className="text-xs font-semibold text-stone-700">Handover notes for the next guard</p>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">
          Incidents / observations during your shift
        </label>
        <textarea
          rows={2}
          value={incidents}
          onChange={(e) => setIncidents(e.target.value)}
          placeholder="Any incidents, observations, or notable events (leave blank if none)"
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">
          Pending items / things to watch
        </label>
        <textarea
          rows={2}
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          placeholder="Items the next guard should follow up on (leave blank if none)"
          className={inputCls}
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-stone-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-60"
        >
          {busy ? "Ending shift…" : "Submit handover & end shift"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-xs text-stone-400 hover:text-stone-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function ShiftPanel({
  posts,
  activeShift,
  lastHandover,
}: {
  posts: GuardPost[];
  activeShift: GuardShift | null;
  lastHandover?: HandoverReport | null;
}) {
  const [state, action, pending] = useActionState(startShift, undefined);
  const [showHandover, setShowHandover] = useState(false);
  const [handoverAcked, setHandoverAcked] = useState(false);

  if (activeShift) {
    const started = new Date(activeShift.startedAt).toLocaleTimeString("en-PH", {
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-emerald-800">
              🟢 On Duty — {activeShift.postName}
            </p>
            <p className="text-xs text-emerald-700">
              {activeShift.shiftType === "day" ? "Day shift" : "Night shift"} · started {started}
            </p>
          </div>
          {!showHandover && (
            <button
              type="button"
              onClick={() => setShowHandover(true)}
              className="rounded-lg border border-stone-400 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100"
            >
              End Shift
            </button>
          )}
        </div>
        {showHandover && (
          <HandoverForm shift={activeShift} onDone={() => setShowHandover(false)} />
        )}
      </div>
    );
  }

  const pendingHandover = lastHandover && !lastHandover.acknowledgedAt && !handoverAcked;

  return (
    <div className="space-y-3">
      {lastHandover && !handoverAcked && (
        <LastHandoverCard
          report={lastHandover}
          onAcknowledge={() => setHandoverAcked(true)}
        />
      )}
      {handoverAcked && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs text-green-800">
          ✓ Handover acknowledged. You may now start your shift.
        </div>
      )}
      <div className={`rounded-xl border bg-amber-50 p-4 ${pendingHandover ? "border-amber-100 opacity-60 pointer-events-none" : "border-amber-200"}`}>
        <p className="mb-3 text-sm font-semibold text-amber-900">Start your guard shift</p>
        <form action={action} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-stone-600">Post</label>
            <select name="post_id" className={inputCls}>
              {posts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[130px] flex-1">
            <label className="mb-1 block text-xs font-medium text-stone-600">Shift type</label>
            <select name="shift_type" className={inputCls}>
              <option value="day">Day (06:00–18:00)</option>
              <option value="night">Night (18:00–06:00)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {pending ? "Starting…" : "Start Shift"}
          </button>
        </form>
        {state && !state.ok && (
          <p className="mt-2 text-xs text-red-600">{state.error}</p>
        )}
      </div>
    </div>
  );
}
