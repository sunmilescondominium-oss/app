"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import type { AuditActor, AuditRow } from "@/lib/audit-queries";

function exportCsv(rows: AuditRow[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["Timestamp (PHT)", "Actor", "Roles", "Action", "Entity", "Entity ID", "Diff"];
  const lines = rows.map((r) => [
    esc(
      new Date(r.createdAt).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    ),
    esc(r.actorLabel ?? "(system)"),
    esc(r.actorRoles.join(", ")),
    esc(r.action),
    esc(r.entity),
    esc(r.entityId ?? ""),
    esc(r.diff ? JSON.stringify(r.diff) : ""),
  ]);
  const csv = [header.join(","), ...lines.map((l) => l.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ActivityFilters({
  entities,
  actions,
  actors,
  current,
  rows,
}: {
  entities: string[];
  actions: string[];
  actors: AuditActor[];
  current: {
    entity?: string;
    action?: string;
    actorUserId?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  rows: AuditRow[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  function reset() {
    router.push("/admin/activity");
  }

  const hasFilter =
    current.entity ||
    current.action ||
    current.actorUserId ||
    current.dateFrom ||
    current.dateTo;

  return (
    <div className="mb-4 rounded-xl border border-stone-200 bg-white p-4">
      <form ref={formRef} method="GET" action="/admin/activity" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Module</label>
          <select
            name="entity"
            defaultValue={current.entity ?? ""}
            className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          >
            <option value="">All modules</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Action</label>
          <select
            name="action"
            defaultValue={current.action ?? ""}
            className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          >
            <option value="">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Actor</label>
          <select
            name="actorUserId"
            defaultValue={current.actorUserId ?? ""}
            className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          >
            <option value="">All users</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">From</label>
          <input
            type="date"
            name="dateFrom"
            defaultValue={current.dateFrom ?? ""}
            className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">To</label>
          <input
            type="date"
            name="dateTo"
            defaultValue={current.dateTo ?? ""}
            className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm text-stone-700 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Apply
          </button>
          {hasFilter && (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {rows.length > 0 && (
        <div className="mt-3 border-t border-stone-100 pt-3">
          <button
            type="button"
            onClick={() => exportCsv(rows)}
            className="text-xs font-medium text-amber-700 hover:underline"
          >
            ↓ Export this page as CSV ({rows.length} rows)
          </button>
        </div>
      )}
    </div>
  );
}
