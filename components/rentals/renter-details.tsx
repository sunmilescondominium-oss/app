"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateRenterDetails, setLeaseDocument, type ActionResult } from "@/app/(app)/rentals/actions";
import { LEASE_TYPES, LEASE_DOC_TYPES } from "@/lib/config";
import type { LeaseDoc } from "@/lib/rentals/types";

const cls = "w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

type Lease = {
  id: string;
  tenantLabel: string;
  contact: string | null;
  email: string | null;
  permanentAddress: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  motorPlate: string | null;
  leaseType: string | null;
  transferredFrom: string | null;
  portalPin: string | null;
};

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string | null }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input name={name} defaultValue={defaultValue ?? ""} className={cls} />
    </label>
  );
}

export function RenterDetails({ lease }: { lease: Lease }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(updateRenterDetails, undefined);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="rounded-2xl border border-slate-200 bg-white p-5">
      <input type="hidden" name="lease_id" value={lease.id} />
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Renter details</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Name" name="tenant_label" defaultValue={lease.tenantLabel} />
        <Field label="Phone" name="contact" defaultValue={lease.contact} />
        <Field label="Email" name="email" defaultValue={lease.email} />
        <Field label="Permanent address" name="permanent_address" defaultValue={lease.permanentAddress} />
        <Field label="Emergency contact (name)" name="emergency_contact" defaultValue={lease.emergencyContact} />
        <Field label="Emergency contact no." name="emergency_phone" defaultValue={lease.emergencyPhone} />
        <Field label="Motor / plate no." name="motor_plate" defaultValue={lease.motorPlate} />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Lease type</span>
          <select name="lease_type" defaultValue={lease.leaseType ?? ""} className={cls}>
            <option value="">—</option>
            {LEASE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
        <Field label="Transferred from (unit)" name="transferred_from" defaultValue={lease.transferredFrom} />
        <Field label="Renter portal PIN" name="portal_pin" defaultValue={lease.portalPin} />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">Give the tenant their unit number + PIN to view bills at /renter-portal.</p>
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save renter details"}
        </button>
        {state && !state.ok && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}

function DocRow({ leaseId, doc }: { leaseId: string; doc: LeaseDoc }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit(formData: FormData) {
    setBusy(true);
    const res = await setLeaseDocument(leaseId, doc.docType, formData);
    setBusy(false);
    if (!res.ok) return window.alert(res.error);
    router.refresh();
  }

  return (
    <form action={submit} className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-2 last:border-0 text-sm">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${doc.submitted ? "bg-emerald-500" : "bg-slate-300"}`} />
      <span className="min-w-[10rem] flex-1 font-medium text-slate-700">{doc.docType}</span>
      <label className="flex items-center gap-1 text-xs text-slate-600">
        <input type="checkbox" name="submitted" value="true" defaultChecked={doc.submitted} className="h-4 w-4" />
        submitted
      </label>
      <input name="file" type="file" className="max-w-[9rem] text-xs" />
      {doc.hasFile && doc.id && (
        <a href={`/api/lease-docs/${doc.id}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-amber-700 hover:underline">view</a>
      )}
      <button type="submit" disabled={busy} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
        {busy ? "…" : "Save"}
      </button>
    </form>
  );
}

export function LeaseDocsChecklist({ leaseId, docs }: { leaseId: string; docs: LeaseDoc[] }) {
  const done = docs.filter((d) => d.submitted).length;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Document checklist</h3>
        <span className="text-xs text-slate-400">{done}/{LEASE_DOC_TYPES.length} submitted</span>
      </div>
      {docs.map((d) => <DocRow key={d.docType} leaseId={leaseId} doc={d} />)}
    </div>
  );
}
