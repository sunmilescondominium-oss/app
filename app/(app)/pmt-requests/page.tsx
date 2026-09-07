import { requireModule } from "@/lib/auth/dal";
import { listPmtRequests, listSourceOptions } from "@/lib/pmt-requests/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Breadcrumb } from "@/components/ui";
import { CreatePmtRequestForm, ApproveRejectForm, ReleaseBudgetForm } from "@/components/pmt-requests/request-forms";
import type { PmtRequest } from "@/lib/pmt-requests/queries";

export const metadata = { title: "Payment Requests" };

const peso = (n: number | null) =>
  n == null ? "—" : `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_BADGE: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700",
  submitted: "bg-blue-100 text-blue-700",
  approved:  "bg-emerald-100 text-emerald-700",
  rejected:  "bg-rose-100 text-rose-700",
  released:  "bg-stone-100 text-stone-600",
};

export default async function PmtRequestsPage() {
  const user = await requireModule("pmt_requests");
  const canWrite = user.roleKeys.some((r) => ["admin", "accounting"].includes(r));

  const [requests, sources] = await Promise.all([
    listPmtRequests(),
    canWrite ? listSourceOptions() : Promise.resolve([]),
  ]);

  let staffOptions: { id: string; name: string; employee_no: string | null }[] = [];
  if (canWrite) {
    const admin = createAdminClient();
    const { data: ur } = await admin
      .from("user_roles")
      .select("user_id, role_key, profiles!inner(full_name, employee_no)")
      .not("role_key", "in", '("buyer","tenant","guest","broker")');
    const seen = new Set<string>();
    staffOptions = (ur ?? [])
      .filter((r) => {
        if (seen.has(r.user_id as string)) return false;
        seen.add(r.user_id as string);
        return true;
      })
      .map((r: Record<string, unknown>) => {
        const p = r.profiles as Record<string, unknown> | null;
        return {
          id: r.user_id as string,
          name: (p?.full_name as string) ?? (r.user_id as string),
          employee_no: (p?.employee_no as string | null) ?? null,
        };
      });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const submitted = requests.filter((r) => r.status === "submitted");
  const approved  = requests.filter((r) => r.status === "approved");
  const pending   = requests.filter((r) => r.status === "pending");
  const done      = requests.filter((r) => ["rejected", "released"].includes(r.status));

  return (
    <>
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Payment Requests" }]} />
      <PageHeader
        title="Payment Requests"
        subtitle="Create secure request forms for petty cash or check payment. Requestor fills via passcode-protected link."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          { label: "Awaiting Requestor", value: pending.length,   color: "text-amber-700" },
          { label: "Submitted",          value: submitted.length,  color: "text-blue-700"  },
          { label: "Approved",           value: approved.length,   color: "text-emerald-700" },
          { label: "Completed",          value: done.length,       color: "text-stone-500"  },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {canWrite && (
        <details className="mb-6 rounded-2xl border border-stone-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-emerald-700">+ New payment request form</summary>
          <div className="mt-4">
            <CreatePmtRequestForm staffOptions={staffOptions} sources={sources} origin={origin} />
          </div>
        </details>
      )}

      {submitted.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-700">Submitted — needs review</h2>
          <div className="space-y-3">
            {submitted.map((r) => <RequestCard key={r.id} req={r} canWrite={canWrite} />)}
          </div>
        </section>
      )}

      {approved.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">Approved — awaiting budget release</h2>
          <div className="space-y-3">
            {approved.map((r) => <RequestCard key={r.id} req={r} canWrite={canWrite} />)}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-700">Pending — link not yet filled</h2>
          <div className="space-y-3">
            {pending.map((r) => <RequestCard key={r.id} req={r} canWrite={canWrite} origin={origin} />)}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Completed / Rejected</h2>
          <div className="space-y-3">
            {done.map((r) => <RequestCard key={r.id} req={r} canWrite={canWrite} />)}
          </div>
        </section>
      )}

      {requests.length === 0 && (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-8 text-center text-sm text-stone-500">
          No payment requests yet. Create one above to get started.
        </div>
      )}
    </>
  );
}

function RequestCard({ req, canWrite, origin = "" }: { req: PmtRequest; canWrite: boolean; origin?: string }) {
  const isExpired = new Date(req.expires_at) < new Date();
  const link = `${origin}/req/${req.link_token}`;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-stone-800">{req.purpose ?? "No purpose stated"}</p>
          <p className="mt-0.5 text-xs text-stone-500">
            For: <span className="font-medium text-stone-700">{req.requestor_name}</span>
            {req.payee_name ? ` · Payee: ${req.payee_name}` : ""}
            {" · "}By {req.creator_name}
          </p>
          <p className="mt-0.5 text-xs text-stone-400">
            {new Date(req.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
            {" · "}Expires {new Date(req.expires_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
            {isExpired && <span className="ml-1 text-rose-600">(expired)</span>}
          </p>
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[req.status] ?? "bg-stone-100 text-stone-600"}`}>
          {req.status}
        </span>
      </div>

      {(req.amount_requested != null || req.primary_source_amount != null) && (
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {req.amount_requested != null && (
            <div>
              <span className="text-xs text-stone-500">Requested</span>
              <p className="font-bold tabular-nums text-stone-800">{peso(req.amount_requested)}</p>
            </div>
          )}
          {req.primary_source_amount != null && (
            <div>
              <span className="text-xs text-stone-500">Primary source</span>
              <p className="font-medium tabular-nums text-stone-700">
                {peso(req.primary_source_amount)} · {req.primary_source_type === "petty_cash" ? "Petty Cash" : "Bank"}
              </p>
            </div>
          )}
          {req.secondary_source_amount != null && (
            <div>
              <span className="text-xs text-stone-500">Secondary source</span>
              <p className="font-medium tabular-nums text-stone-700">
                {peso(req.secondary_source_amount)} · {req.secondary_source_type === "petty_cash" ? "Petty Cash" : "Bank"}
              </p>
            </div>
          )}
        </div>
      )}

      {req.description && (
        <p className="mt-2 text-sm italic text-stone-600">&ldquo;{req.description}&rdquo;</p>
      )}

      {req.supporting_doc_url && (
        <a href={req.supporting_doc_url} target="_blank" rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 underline">
          View supporting document
        </a>
      )}

      {req.rejection_reason && (
        <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <strong>Rejection reason:</strong> {req.rejection_reason}
        </div>
      )}

      {req.approval_note && (
        <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <strong>Approval note:</strong> {req.approval_note}
        </div>
      )}

      {req.status === "pending" && !isExpired && (
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded bg-stone-100 px-2 py-1 text-xs text-stone-700">{link}</code>
          <span className="shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-500">
            Copy link above
          </span>
        </div>
      )}

      {canWrite && req.status === "submitted" && (
        <div className="mt-4">
          <ApproveRejectForm id={req.id} />
        </div>
      )}
      {canWrite && req.status === "approved" && (
        <div className="mt-4">
          <ReleaseBudgetForm id={req.id} />
        </div>
      )}
    </div>
  );
}
