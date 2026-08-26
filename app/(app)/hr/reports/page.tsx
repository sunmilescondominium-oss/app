import Link from "next/link";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { listReports } from "./actions";
import { ReportForm } from "@/components/hr/report-form";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Employee Reports" };

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  safety: "Safety",
  compliance: "Compliance",
  suggestion: "Suggestion",
  grievance: "Grievance",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  safety: "bg-rose-100 text-rose-700",
  compliance: "bg-orange-100 text-orange-700",
  grievance: "bg-purple-100 text-purple-700",
  suggestion: "bg-emerald-100 text-emerald-700",
  general: "bg-stone-100 text-stone-700",
  other: "bg-stone-100 text-stone-700",
};

export default async function EmployeeReportsPage() {
  const user = await requireAuth();
  const isManager = userHasAnyRole(user, ["admin", "owner", "consultant"]);
  const reports = await listReports();

  return (
    <>
      <div className="mb-6">
        <PageHeader
          backHref="/hr"
          title="Employee Reports"
          subtitle={isManager ? "Work-related reports submitted by staff" : "Submit and view your work-related reports"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Submit form — all employees */}
        <div>
          <ReportForm />
        </div>

        {/* Report list */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            {isManager ? "All submitted reports" : "Your submitted reports"}
          </h3>
          {reports.length === 0 ? (
            <p className="rounded-2xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
              No reports yet.
            </p>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-stone-800 text-sm leading-snug">{r.subject}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CATEGORY_COLORS[r.category] ?? CATEGORY_COLORS.other}`}>
                    {CATEGORY_LABELS[r.category] ?? r.category}
                  </span>
                </div>
                <p className="text-sm text-stone-600 line-clamp-3 whitespace-pre-line">{r.body}</p>
                <div className="flex items-center gap-2 text-[11px] text-stone-400">
                  <span>{new Date(r.created_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</span>
                  {isManager && (
                    <>
                      <span>·</span>
                      <span>{r.is_anonymous ? "Anonymous" : (r.reporter_label ?? "Staff")}</span>
                    </>
                  )}
                  {r.is_anonymous && !isManager && (
                    <>
                      <span>·</span>
                      <span className="text-stone-400">Submitted anonymously</span>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
