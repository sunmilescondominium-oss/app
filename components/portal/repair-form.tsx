"use client";

import { useActionState, useState } from "react";
import {
  submitRepairRequest,
  type SubmitState,
} from "@/app/(public)/repair-request/actions";
import { REPAIR_URGENCY, REPAIR_ISSUE_TYPES } from "@/lib/config";
import { CameraCapture } from "@/components/capture/camera-capture";

const inputCls =
  "w-full rounded-lg border border-stone-300 px-3 py-2.5 text-stone-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-sm font-medium text-stone-700";

export function RepairForm() {
  const [state, action, pending] = useActionState<SubmitState, FormData>(
    submitRepairRequest,
    undefined,
  );
  const [photo, setPhoto] = useState<{ file: File; at: string } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (photo) {
      fd.set("photo", photo.file);
      fd.set("captured_at", photo.at);
    }
    action(fd);
  }

  if (state?.ok) {
    return (
      <div className="text-center">
        <p className="text-3xl">✅</p>
        <h2 className="mt-2 text-lg font-bold text-stone-900">Request submitted</h2>
        <p className="mt-1 text-sm text-stone-600">
          Your ticket reference is
        </p>
        <p className="mt-1 text-xl font-bold tracking-wide text-amber-700">{state.ticket}</p>
        <p className="mt-3 text-sm text-stone-500">
          Please keep this reference. Our team has been notified and will act on it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      <div>
        <label className={labelCls}>I am a…</label>
        <select name="requester_type" defaultValue="tenant" className={inputCls}>
          <option value="tenant">Tenant</option>
          <option value="guest">Hotel guest</option>
        </select>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Unit / room number</label>
          <input name="unit_number" className={inputCls} placeholder="e.g. H03 or Suite-201" />
        </div>
        <div>
          <label className={labelCls}>Reference (PIN / booking ref)</label>
          <input name="requester_ref" className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Issue type</label>
          <select name="issue_type" defaultValue="Electrical" className={inputCls}>
            {REPAIR_ISSUE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Urgency</label>
          <select name="urgency" defaultValue="normal" className={inputCls}>
            {REPAIR_URGENCY.map((u) => (
              <option key={u.key} value={u.key}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Describe the issue *</label>
        <textarea name="description" required rows={3} className={inputCls} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Photo of the issue (optional)</label>
          {photo ? (
            <p className="text-sm text-emerald-700">
              ✓ Photo taken {new Date(photo.at).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" })}{" "}
              <button type="button" onClick={() => setPhoto(null)} className="text-amber-700 underline">retake</button>
            </p>
          ) : (
            <CameraCapture label="Repair request" buttonText="Take photo" onCapture={(f, at) => setPhoto({ file: f, at })} />
          )}
        </div>
        <div>
          <label className={labelCls}>Email for updates (optional)</label>
          <input name="requester_contact" type="email" className={inputCls} />
        </div>
      </div>

      {state && !state.ok && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}
