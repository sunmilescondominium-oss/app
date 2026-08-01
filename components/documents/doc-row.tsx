"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { setDocumentStatus, uploadDocumentScan } from "@/app/(app)/documents/actions";
import { DOCUMENT_STATUSES } from "@/lib/config";
import type { DocumentType, BuyerDocument } from "@/lib/documents/types";

const STATUS_CLS: Record<string, string> = {
  not_required: "bg-slate-100 text-slate-500",
  pending: "bg-slate-100 text-slate-600",
  received: "bg-blue-100 text-blue-800",
  signed: "bg-indigo-100 text-indigo-800",
  filed: "bg-emerald-100 text-emerald-800",
  overdue: "bg-red-100 text-red-700",
  disputed: "bg-orange-100 text-orange-800",
};
const smallInput =
  "rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function DocRow({
  buyerId,
  type,
  doc,
  canWrite,
  consentGiven,
}: {
  buyerId: string;
  type: DocumentType;
  doc: BuyerDocument | null;
  canWrite: boolean;
  consentGiven: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(doc?.status ?? "pending");
  const [refNumber, setRefNumber] = useState(doc?.ref_number ?? "");
  const [docDate, setDocDate] = useState(doc?.doc_date ?? "");
  const [notes, setNotes] = useState(doc?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setBusy(true);
    setMsg("");
    const r = await setDocumentStatus(buyerId, type.id, {
      status,
      ref_number: refNumber,
      doc_date: docDate,
      notes,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    setMsg("Saved");
    router.refresh();
  }

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type.is_sensitive_id && !consentGiven) {
      setMsg("Capture consent first.");
      e.target.value = "";
      return;
    }
    setBusy(true);
    setMsg("Uploading…");
    const fd = new FormData();
    fd.append("file", file);
    const r = await uploadDocumentScan(buyerId, type.id, fd);
    setBusy(false);
    e.target.value = "";
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    setMsg("Uploaded");
    router.refresh();
  }

  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">
          {type.name}
          {type.is_sensitive_id && (
            <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-600">
              ID · consent
            </span>
          )}
        </p>
        {doc?.file_path && (
          <a
            href={`/api/documents/${doc.id}/download`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-amber-700 hover:underline"
          >
            View scan
          </a>
        )}
      </div>

      {canWrite ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={smallInput}>
            {DOCUMENT_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <input value={refNumber} onChange={(e) => setRefNumber(e.target.value)} placeholder="Ref #" className={`${smallInput} w-28`} />
          <input type="date" value={docDate ?? ""} onChange={(e) => setDocDate(e.target.value)} className={smallInput} />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className={`${smallInput} w-40`} />
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Save
          </button>
          <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
            Upload
            <input type="file" onChange={upload} className="hidden" />
          </label>
          {msg && <span className="text-xs text-slate-400">{msg}</span>}
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${STATUS_CLS[status] ?? ""}`}>
            {status}
          </span>
          {refNumber && <span>Ref: {refNumber}</span>}
          {docDate && <span>{docDate}</span>}
        </div>
      )}
    </div>
  );
}
