"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveMaintenanceIssue, updateMaintenanceIssueStatus } from "@/app/(app)/hotel/actions";
import type { MaintenanceIssue } from "@/lib/hotel/types";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

const STATUS_COLOR: Record<string, string> = {
  open: "bg-red-100 text-red-800 border-red-200",
  in_progress: "bg-amber-100 text-amber-800 border-amber-200",
  resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(iso));
}

export function MaintenanceIssuePanel({
  issue,
  canResolve,
}: {
  issue: MaintenanceIssue;
  canResolve: boolean;
}) {
  const router = useRouter();
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [fixReport, setFixReport] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  function resolve() {
    setErr("");
    if (!fixReport.trim()) { setErr("Please describe what was fixed."); return; }
    start(async () => {
      const res = await resolveMaintenanceIssue(issue.id, fixReport);
      if (!res.ok) { setErr(res.error); return; }
      setShowResolveForm(false);
      router.refresh();
    });
  }

  function markInProgress() {
    start(async () => {
      await updateMaintenanceIssueStatus(issue.id, "in_progress");
      router.refresh();
    });
  }

  const isResolved = issue.status === "resolved";
  const borderClass = isResolved ? "border-emerald-200" : "border-rose-200";
  const bgClass = isResolved ? "bg-emerald-50" : "bg-rose-50";

  return (
    <div className={`no-print rounded-2xl border-2 p-4 ${borderClass} ${bgClass}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-base font-bold text-stone-800">
          {isResolved ? "🔧" : "⚠️"} Room Maintenance Issue
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[issue.status]}`}>
          {STATUS_LABEL[issue.status]}
        </span>
      </div>

      <p className="mb-1 text-sm text-stone-800">{issue.description}</p>
      <p className="text-xs text-stone-500">
        Reported by {issue.reporter_name ?? "staff"} · {fmt(issue.reported_at)}
      </p>

      {isResolved && (
        <div className="mt-3 rounded-xl border border-emerald-300 bg-white px-3 py-2">
          <p className="mb-0.5 text-xs font-semibold text-emerald-800">Fix / repair report</p>
          <p className="text-sm text-stone-700">{issue.fix_report}</p>
          <p className="mt-1 text-xs text-stone-400">
            Fixed by {issue.resolver_name ?? "maintenance"} · {issue.resolved_at ? fmt(issue.resolved_at) : "—"}
          </p>
          <p className="mt-0.5 text-xs text-stone-400">
            Room uses since fix: {issue.stays_after_fix}/5
            {issue.visible_until
              ? ` · Visible until ${fmt(issue.visible_until)}`
              : ""}
          </p>
        </div>
      )}

      {!isResolved && canResolve && (
        <div className="mt-3 space-y-2">
          {issue.status === "open" && (
            <button
              type="button"
              onClick={markInProgress}
              disabled={pending}
              className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
            >
              {pending ? "…" : "Mark in-progress"}
            </button>
          )}
          {!showResolveForm ? (
            <button
              type="button"
              onClick={() => setShowResolveForm(true)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Mark resolved + add fix report
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={fixReport}
                onChange={(e) => { setFixReport(e.target.value); setErr(""); }}
                rows={3}
                placeholder="Describe what was fixed or repaired…"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
              {err && <p className="text-xs text-red-600">{err}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resolve}
                  disabled={pending}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {pending ? "Saving…" : "Submit resolution"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowResolveForm(false); setErr(""); }}
                  className="rounded-lg border border-stone-300 px-4 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
