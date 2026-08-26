"use client";

import { useActionState, useState } from "react";
import { submitReport } from "@/app/(app)/hr/reports/actions";
import type { ActionResult } from "@/app/(app)/hr/reports/actions";

const inputCls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const labelCls = "mb-1 block text-xs font-medium text-stone-600";

const CATEGORIES = [
  { value: "general", label: "General / work update" },
  { value: "safety", label: "Safety concern" },
  { value: "compliance", label: "Compliance / policy issue" },
  { value: "suggestion", label: "Suggestion / improvement" },
  { value: "grievance", label: "Grievance" },
  { value: "other", label: "Other" },
] as const;

export function ReportForm() {
  const [result, action, pending] = useActionState<ActionResult | undefined, FormData>(submitReport, undefined);
  const [dpaChecked, setDpaChecked] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (submitted && result?.ok) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-2xl">✅</p>
        <p className="mt-2 font-semibold text-emerald-800">Report submitted</p>
        <p className="mt-1 text-sm text-emerald-700">Your report has been recorded and will be reviewed by management.</p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-4 rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
        >
          Submit another report
        </button>
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        fd.set("dpa_consent", dpaChecked ? "1" : "0");
        setSubmitted(true);
        return action(fd);
      }}
      className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5"
    >
      <h3 className="font-semibold text-stone-800">Submit a work-related report</h3>

      {/* DPA Notice */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Data Privacy Notice</p>
        <p className="mt-1 text-xs">
          Your report is collected under the Data Privacy Act of 2012 (RA 10173). It will be used solely for internal
          management purposes and accessible only to authorized officers (Admin, Owner, Consultant). Anonymous reports
          will not display your name but your identity may be disclosed if legally required. You may choose to submit
          anonymously; however, providing your identity helps management follow up appropriately.
        </p>
        <label className="mt-3 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={dpaChecked}
            onChange={(e) => setDpaChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-stone-300 accent-amber-600"
          />
          <span className="text-xs font-medium">
            I have read and understood the data privacy notice and consent to the collection of my report.
          </span>
        </label>
      </div>

      <div>
        <label className={labelCls}>Category *</label>
        <select name="category" defaultValue="general" className={inputCls}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelCls}>Subject *</label>
        <input type="text" name="subject" required minLength={5} maxLength={200} placeholder="Brief title of your report" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Details *</label>
        <textarea name="body" required minLength={10} maxLength={4000} rows={6} placeholder="Describe the situation, incident, or suggestion clearly and factually…" className={inputCls} />
        <p className="mt-0.5 text-right text-[10px] text-stone-400">Max 4,000 characters</p>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" name="is_anonymous_toggle" className="h-4 w-4 rounded border-stone-300 accent-amber-600"
          onChange={(e) => {
            const form = e.target.form;
            if (form) {
              const hidden = form.elements.namedItem("is_anonymous") as HTMLInputElement | null;
              if (hidden) hidden.value = e.target.checked ? "1" : "0";
            }
          }}
        />
        Submit anonymously (your name will not be shown to reviewers)
      </label>
      <input type="hidden" name="is_anonymous" defaultValue="0" />

      {result && !result.ok && (
        <p className="text-sm text-red-600">{result.error}</p>
      )}

      <button
        type="submit"
        disabled={pending || !dpaChecked}
        className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit report"}
      </button>
    </form>
  );
}
