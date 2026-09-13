import Link from "next/link";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import { listAuditLog, listAuditFilterOptions } from "@/lib/audit-queries";
import { ActivityFilters } from "./activity-filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity Log" };

const ACTION_BADGE: Record<string, string> = {
  create:   "bg-emerald-100 text-emerald-800 border-emerald-200",
  update:   "bg-sky-100 text-sky-800 border-sky-200",
  delete:   "bg-rose-100 text-rose-800 border-rose-200",
};

function actionBadgeClass(action: string): string {
  if (ACTION_BADGE[action]) return ACTION_BADGE[action];
  if (action.includes("override")) return "bg-amber-100 text-amber-800 border-amber-200";
  if (action.includes("delete") || action.includes("cancel") || action.includes("void"))
    return "bg-rose-100 text-rose-800 border-rose-200";
  if (action.includes("create") || action.includes("add") || action.includes("invite"))
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  return "bg-stone-100 text-stone-700 border-stone-200";
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function sp(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "managing_officer", "consultant"])) {
    return <p className="p-8 text-sm text-stone-500">Access denied.</p>;
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);
  const PAGE_SIZE = 50;

  const filters = {
    entity:      sp(params.entity),
    action:      sp(params.action),
    actorUserId: sp(params.actorUserId),
    dateFrom:    sp(params.dateFrom),
    dateTo:      sp(params.dateTo),
    page,
    pageSize: PAGE_SIZE,
  };

  const [{ rows, total }, options] = await Promise.all([
    listAuditLog(filters),
    listAuditFilterOptions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeFrom = (page - 1) * PAGE_SIZE + 1;
  const rangeTo   = Math.min(page * PAGE_SIZE, total);

  function pageUrl(p: number) {
    const q = new URLSearchParams();
    if (filters.entity)      q.set("entity",      filters.entity);
    if (filters.action)      q.set("action",      filters.action);
    if (filters.actorUserId) q.set("actorUserId", filters.actorUserId);
    if (filters.dateFrom)    q.set("dateFrom",    filters.dateFrom);
    if (filters.dateTo)      q.set("dateTo",      filters.dateTo);
    if (p > 1)               q.set("page",        String(p));
    const qs = q.toString();
    return `/admin/activity${qs ? "?" + qs : ""}`;
  }

  return (
    <>
      <PageHeader
        backHref="/admin"
        title="Activity Log"
        subtitle="Audit trail of every create, update, delete, and override across the system."
      />

      <ActivityFilters
        entities={options.entities}
        actions={options.actions}
        actors={options.actors}
        current={{
          entity:      filters.entity,
          action:      filters.action,
          actorUserId: filters.actorUserId,
          dateFrom:    filters.dateFrom,
          dateTo:      filters.dateTo,
        }}
        rows={rows}
      />

      {/* Summary */}
      <div className="mb-3 flex items-center justify-between text-xs text-stone-500">
        <span>
          {total === 0
            ? "No entries match."
            : `Showing ${rangeFrom}–${rangeTo} of ${total.toLocaleString()} entries`}
        </span>
        <span>Page {page} of {totalPages}</span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-400">
          No activity entries match the selected filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">Time (PHT)</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">Actor</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">Action</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">Module</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">ID</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                  <td className="px-4 py-2.5 text-xs text-stone-500 tabular-nums whitespace-nowrap">
                    {fmtDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-xs font-medium text-stone-800">{row.actorLabel ?? <span className="text-stone-400">system</span>}</p>
                    {row.actorRoles.length > 0 && (
                      <p className="text-[10px] text-stone-400">{row.actorRoles.join(", ")}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${actionBadgeClass(row.action)}`}>
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium text-stone-700">
                    {row.entity}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] font-mono text-stone-400 max-w-[120px] truncate" title={row.entityId ?? ""}>
                    {row.entityId ? row.entityId.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.diff ? (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-amber-700 hover:underline select-none">
                          Show diff
                        </summary>
                        <pre className="mt-1.5 max-h-40 overflow-auto rounded-lg bg-stone-50 p-2 text-[10px] leading-relaxed text-stone-600 font-mono whitespace-pre-wrap break-all border border-stone-200">
                          {JSON.stringify(row.diff, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-[11px] text-stone-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link
              href={pageUrl(page - 1)}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            >
              ← Previous
            </Link>
          ) : (
            <span className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-300 cursor-default">
              ← Previous
            </span>
          )}

          <span className="text-xs text-stone-500">
            Page {page} of {totalPages}
          </span>

          {page < totalPages ? (
            <Link
              href={pageUrl(page + 1)}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            >
              Next →
            </Link>
          ) : (
            <span className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-300 cursor-default">
              Next →
            </span>
          )}
        </div>
      )}
    </>
  );
}
