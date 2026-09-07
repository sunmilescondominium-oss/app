"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { verifyPmtRequestPasscode, submitPmtRequest } from "@/lib/pmt-requests/public-actions";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Step = "loading" | "locked" | "form" | "confirm" | "done" | "error";

interface ReqMeta {
  id: string;
  requestorName: string;
  purpose: string | null;
  payeeName: string | null;
  primarySourceType: string | null;
  primarySourceAmount: number | null;
  secondarySourceAmount: number | null;
  expiresAt: string;
  status: string;
}

export default function RequisitionFormPage({ params }: { params: { token: string } }) {
  const { token } = params;

  const [step, setStep] = useState<Step>("loading");
  const [meta, setMeta] = useState<ReqMeta | null>(null);
  const [passcode, setPasscode] = useState("");
  const [requestorName, setRequestorName] = useState("");
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({ description: "", amount: "", docUrl: "" });
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load meta via a lightweight fetch to get status/expiry without exposing hash
  useEffect(() => {
    fetch(`/api/req/${token}/meta`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setStep("error"); return; }
        setMeta(d);
        if (d.status !== "pending") {
          setError(
            d.status === "submitted" ? "This form has already been submitted." :
            d.status === "released" ? "This requisition has already been released." :
            `Status: ${d.status}. No further action needed.`
          );
          setStep("error");
          return;
        }
        if (new Date(d.expiresAt) < new Date()) {
          setError("This link has expired. Please contact accounting for a new link.");
          setStep("error");
          return;
        }
        setStep("locked");
      })
      .catch(() => { setError("Unable to load form. Please try again."); setStep("error"); });
  }, [token]);

  const handlePasscodeVerify = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!passcode.trim()) { setError("Enter your passcode."); return; }
    const result = await verifyPmtRequestPasscode(token, passcode);
    if (!result.ok) { setError(result.error); return; }
    setRequestorName(result.requestorName ?? "");
    setStep("form");
  }, [token, passcode]);

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!formData.description.trim()) { setError("Please describe your request."); return; }
    const amount = parseFloat(formData.amount);
    if (!amount || amount <= 0) { setError("Enter a valid amount."); return; }
    setStep("confirm");
  }, [formData]);

  const handleConfirmSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const confirmPasscode = (e.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>("[name=confirm_passcode]")?.value ?? "";
    if (!confirmPasscode.trim()) { setError("Enter your passcode to confirm."); return; }
    setSubmitting(true);
    const result = await submitPmtRequest(token, confirmPasscode, {
      description: formData.description,
      amount_requested: parseFloat(formData.amount),
      supporting_doc_url: formData.docUrl || undefined,
    });
    setSubmitting(false);
    if (!result.ok) { setError(result.error); return; }
    setStep("done");
  }, [token, formData]);

  // ── File upload handler (uploads to Supabase storage via API route) ────────
  const handleFileUpload = useCallback(async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("token", token);
    const res = await fetch("/api/req/upload-doc", { method: "POST", body: fd });
    const json = await res.json();
    if (json.url) setFormData((prev) => ({ ...prev, docUrl: json.url }));
  }, [token]);

  if (step === "loading") {
    return <Layout><p className="text-stone-500 text-sm">Loading form…</p></Layout>;
  }

  if (step === "error") {
    return (
      <Layout>
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">{error}</div>
      </Layout>
    );
  }

  if (step === "done") {
    return (
      <Layout>
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-6 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="font-semibold text-emerald-800">Requisition submitted!</p>
          <p className="mt-1 text-sm text-emerald-700">
            Accounting has been notified. You will receive a message once it is reviewed.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {meta && (
        <div className="mb-4 rounded-xl bg-stone-50 border border-stone-200 p-4 text-sm">
          <p className="font-semibold text-stone-700">{meta.purpose ?? "Payment Requisition"}</p>
          {meta.payeeName && <p className="text-stone-500">Payee: {meta.payeeName}</p>}
          {(meta.primarySourceAmount || meta.secondarySourceAmount) && (
            <p className="text-stone-500">
              Allocated: {peso((meta.primarySourceAmount ?? 0) + (meta.secondarySourceAmount ?? 0))}
            </p>
          )}
          <p className="mt-1 text-xs text-stone-400">
            Expires: {new Date(meta.expiresAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
      )}

      {step === "locked" && (
        <form onSubmit={handlePasscodeVerify} className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            This requisition form is access-protected. Enter your system passcode to continue.
          </div>
          <div>
            <label className="label-sm">Your passcode</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter your PIN / passcode"
              className="input w-full text-center text-xl tracking-widest"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button type="submit" className="btn-primary w-full">Unlock Form</button>
        </form>
      )}

      {step === "form" && (
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Welcome, <strong>{requestorName}</strong>. Please complete the details below.
          </div>
          <div>
            <label className="label-sm">Describe your request *</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              rows={4}
              placeholder="Provide details about what you need this fund for…"
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="label-sm">Amount requested (₱) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.amount}
              onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
              className="input w-full tabular-nums"
              required
            />
          </div>
          <div>
            <label className="label-sm">Supporting document (optional)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}
              className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border file:border-stone-300 file:bg-white file:px-3 file:py-1 file:text-xs file:font-medium"
            />
            {formData.docUrl && (
              <p className="mt-1 text-xs text-emerald-600">✓ Document uploaded successfully</p>
            )}
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button type="submit" className="btn-primary w-full">Review & Submit</button>
        </form>
      )}

      {step === "confirm" && (
        <form onSubmit={handleConfirmSubmit} className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            <p className="font-semibold mb-2">Review your submission</p>
            <p><span className="text-blue-600">Description:</span> {formData.description}</p>
            <p className="mt-1"><span className="text-blue-600">Amount:</span> <strong>{peso(parseFloat(formData.amount))}</strong></p>
            {formData.docUrl && <p className="mt-1 text-blue-600">✓ Supporting document attached</p>}
          </div>
          <div>
            <label className="label-sm">Enter your passcode to confirm submission *</label>
            <input
              type="password"
              name="confirm_passcode"
              placeholder="Enter your PIN / passcode"
              className="input w-full text-center text-xl tracking-widest"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep("form")}
              className="flex-1 rounded-xl border border-stone-300 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              ← Back
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 rounded-xl bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              {submitting ? "Submitting…" : "Confirm & Submit"}
            </button>
          </div>
        </form>
      )}
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-start justify-center pt-12 px-4 pb-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Sun Miles Properties</p>
          <h1 className="mt-1 text-xl font-bold text-stone-800">Payment Requisition</h1>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
