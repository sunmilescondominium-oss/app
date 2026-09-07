"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPmtRequest, approvePmtRequest, rejectPmtRequest, releasePmtBudget } from "@/lib/pmt-requests/actions";
import type { SourceOption } from "@/lib/pmt-requests/queries";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Create Payment Request Form ─────────────────────────────────────────────

interface StaffOption { id: string; name: string; employee_no: string | null }

export function CreatePmtRequestForm({
  staffOptions,
  sources,
  origin,
}: {
  staffOptions: StaffOption[];
  sources: SourceOption[];
  origin: string;
}) {
  const [state, action, pending] = useActionState(createPmtRequest, null);
  const [showSecondary, setShowSecondary] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && state.data?.token) {
      setGeneratedLink(`${origin}/req/${state.data.token}`);
      formRef.current?.reset();
      setShowSecondary(false);
    }
  }, [state, origin]);

  const bankSources = sources.filter((s) => s.type === "bank");
  const pcSources = sources.filter((s) => s.type === "petty_cash");

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label-sm">Requestor *</label>
          <select name="requestor_user_id" required className="input w-full">
            <option value="">Select staff member…</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.employee_no ? ` (${s.employee_no})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-sm">Link expires at *</label>
          <input type="datetime-local" name="expires_at" required className="input w-full" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label-sm">Payee / Vendor</label>
          <input type="text" name="payee_name" placeholder="e.g. SM Store" className="input w-full" />
        </div>
        <div>
          <label className="label-sm">Purpose</label>
          <input type="text" name="purpose" placeholder="e.g. Office supplies purchase" className="input w-full" />
        </div>
      </div>

      <div>
        <label className="label-sm">Payment type</label>
        <select name="payment_type" className="input w-full">
          <option value="">Not specified</option>
          <option value="petty_cash">Petty Cash</option>
          <option value="check">Check Payment</option>
        </select>
      </div>

      <fieldset className="rounded-xl border border-stone-200 p-4">
        <legend className="px-1 text-xs font-semibold text-stone-600">Primary Budget Source</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label-sm">Source type</label>
            <select name="primary_source_type" className="input w-full">
              <option value="">Not specified</option>
              <option value="bank">Bank Account</option>
              <option value="petty_cash">Petty Cash Fund</option>
            </select>
          </div>
          <div>
            <label className="label-sm">Account / Fund</label>
            <select name="primary_source_id" className="input w-full">
              <option value="">Select…</option>
              {bankSources.map((s) => (
                <option key={s.id} value={s.id}>Bank: {s.label} (bal: {peso(s.balance)})</option>
              ))}
              {pcSources.map((s) => (
                <option key={s.id} value={s.id}>PC: {s.label} (bal: {peso(s.balance)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-sm">Allocated amount</label>
            <input type="number" name="primary_source_amount" step="0.01" min="0" placeholder="0.00" className="input w-full" />
          </div>
        </div>

        <button type="button" onClick={() => setShowSecondary(!showSecondary)}
          className="mt-3 text-xs text-blue-600 underline">
          {showSecondary ? "Remove secondary source" : "+ Add secondary source (if primary insufficient)"}
        </button>

        {showSecondary && (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label-sm">Secondary type</label>
              <select name="secondary_source_type" className="input w-full">
                <option value="">Not specified</option>
                <option value="bank">Bank Account</option>
                <option value="petty_cash">Petty Cash Fund</option>
              </select>
            </div>
            <div>
              <label className="label-sm">Account / Fund</label>
              <select name="secondary_source_id" className="input w-full">
                <option value="">Select…</option>
                {bankSources.map((s) => (
                  <option key={s.id} value={s.id}>Bank: {s.label} (bal: {peso(s.balance)})</option>
                ))}
                {pcSources.map((s) => (
                  <option key={s.id} value={s.id}>PC: {s.label} (bal: {peso(s.balance)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-sm">Allocated amount</label>
              <input type="number" name="secondary_source_amount" step="0.01" min="0" placeholder="0.00" className="input w-full" />
            </div>
          </div>
        )}
      </fieldset>

      {state && !state.ok && <p className="text-sm text-rose-600">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Creating…" : "Create & Get Link"}
      </button>

      {generatedLink && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="mb-1 text-xs font-semibold text-emerald-700">Requisition created! Send this link to the requestor:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded border border-emerald-200 bg-white px-2 py-1 text-xs text-stone-800">
              {generatedLink}
            </code>
            <button type="button" onClick={() => navigator.clipboard.writeText(generatedLink)}
              className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
              Copy
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

// ── Approve / Reject Form ───────────────────────────────────────────────────

export function ApproveRejectForm({ id }: { id: string }) {
  const [approveState, approveAction, approvePending] = useActionState(approvePmtRequest, null);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectPmtRequest, null);
  const [showReject, setShowReject] = useState(false);

  return (
    <div className="w-full space-y-3">
      {!showReject && (
        <form action={approveAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={id} />
          <div className="flex-1">
            <label className="label-sm">Approval note (optional)</label>
            <input type="text" name="approval_note" placeholder="e.g. Budget from petty cash, collect by Friday" className="input w-full" />
          </div>
          <button type="submit" disabled={approvePending}
            className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {approvePending ? "Approving…" : "✓ Approve"}
          </button>
          <button type="button" onClick={() => setShowReject(true)}
            className="shrink-0 rounded-xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50">
            Reject
          </button>
        </form>
      )}
      {approveState && !approveState.ok && <p className="text-sm text-rose-600">{approveState.error}</p>}

      {showReject && (
        <form action={rejectAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={id} />
          <div className="flex-1">
            <label className="label-sm">Rejection reason *</label>
            <input type="text" name="rejection_reason" required placeholder="State the reason for rejection" className="input w-full" />
          </div>
          <button type="submit" disabled={rejectPending}
            className="shrink-0 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">
            {rejectPending ? "Rejecting…" : "Confirm Reject"}
          </button>
          <button type="button" onClick={() => setShowReject(false)}
            className="shrink-0 rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50">
            Cancel
          </button>
        </form>
      )}
      {rejectState && !rejectState.ok && <p className="text-sm text-rose-600">{rejectState.error}</p>}
    </div>
  );
}

// ── Release Budget Form ─────────────────────────────────────────────────────

export function ReleaseBudgetForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(releasePmtBudget, null);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {state && !state.ok && <p className="mb-2 text-sm text-rose-600">{state.error}</p>}
      {state?.ok && <p className="mb-2 text-sm text-emerald-600">Budget released. Expense recorded and notification sent.</p>}
      <button type="submit" disabled={pending}
        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {pending ? "Processing…" : "💰 Mark Budget as Released"}
      </button>
    </form>
  );
}
