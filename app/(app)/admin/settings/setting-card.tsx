"use client";

import { useState, useTransition } from "react";
import { saveAppSetting, restoreSetting } from "./actions";
import type { AppSetting, AppSettingHistory } from "@/lib/settings/app-settings";

const TIMEZONE_OPTIONS = [
  { value: "Asia/Manila", label: "Asia/Manila (PHT, UTC+8)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT, UTC+8)" },
  { value: "Asia/Hong_Kong", label: "Asia/Hong_Kong (HKT, UTC+8)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST, UTC+9)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST, UTC+4)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST, UTC+5:30)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT)" },
  { value: "UTC", label: "UTC" },
];

// Keys that require a confirmation step before saving
const SENSITIVE_KEYS = new Set(["referral_fee_hotel", "referral_window_minutes", "timezone"]);

interface Props {
  setting: AppSetting;
  history: AppSettingHistory[];
  canWrite: boolean;
}

export function SettingCard({ setting: s, history, canWrite }: Props) {
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFd, setPendingFd] = useState<FormData | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const isSensitive = SENSITIVE_KEYS.has(s.key);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  }

  function runSave(fd: FormData) {
    startTransition(async () => {
      const result = await saveAppSetting(fd);
      if (result.success) {
        showToast("success", "Saved successfully.");
      } else {
        showToast("error", result.error ?? "Save failed.");
      }
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (isSensitive) {
      setPendingFd(fd);
      setConfirmOpen(true);
    } else {
      runSave(fd);
    }
  }

  function handleConfirm() {
    setConfirmOpen(false);
    if (pendingFd) runSave(pendingFd);
  }

  function handleRestore(entry: AppSettingHistory) {
    if (!entry.old_value) return;
    startTransition(async () => {
      const result = await restoreSetting(entry.id, s.key, entry.old_value!);
      if (result.success) {
        showToast("success", `Restored to "${entry.old_value}".`);
      } else {
        showToast("error", result.error ?? "Restore failed.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 relative">
      {/* Toast notification */}
      {toast && (
        <div
          className={`absolute top-3 right-3 z-10 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm border ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {toast.type === "success" ? "✓ " : "✕ "}
          {toast.message}
        </div>
      )}

      <p className="text-sm font-semibold text-stone-800">
        {s.label}
        {isSensitive && (
          <span className="ml-2 text-[10px] font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
            requires confirmation
          </span>
        )}
      </p>
      {s.description && (
        <p className="mt-0.5 text-xs text-stone-500">{s.description}</p>
      )}

      {canWrite ? (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="key" value={s.key} />
          {s.key === "timezone" ? (
            <select
              name="value"
              defaultValue={s.value}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              {!TIMEZONE_OPTIONS.some((o) => o.value === s.value) && (
                <option value={s.value}>{s.value}</option>
              )}
            </select>
          ) : (
            <input
              name="value"
              type="text"
              defaultValue={s.value}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          )}
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </form>
      ) : (
        <p className="mt-2 font-mono text-sm text-stone-700">{s.value}</p>
      )}

      <div className="mt-2 flex items-center justify-between gap-4">
        <p className="text-[11px] text-stone-400">
          Last updated:{" "}
          {new Date(s.updated_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
        </p>
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-[11px] text-amber-600 hover:underline shrink-0"
          >
            {showHistory ? "Hide history" : `History (${history.length})`}
          </button>
        )}
      </div>

      {/* Change history panel */}
      {showHistory && history.length > 0 && (
        <div className="mt-3 rounded-lg border border-stone-100 bg-stone-50 divide-y divide-stone-100 overflow-hidden">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div>
                <p className="text-xs text-stone-600">
                  <span className="font-mono text-stone-400 line-through">
                    {entry.old_value ?? "—"}
                  </span>
                  <span className="mx-1 text-stone-400">→</span>
                  <span className="font-mono font-medium text-stone-700">
                    {entry.new_value}
                  </span>
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  {new Date(entry.changed_at).toLocaleString("en-PH", {
                    timeZone: "Asia/Manila",
                  })}
                </p>
              </div>
              {canWrite && entry.old_value && (
                <button
                  type="button"
                  onClick={() => handleRestore(entry)}
                  disabled={isPending}
                  className="text-[11px] text-amber-600 hover:underline disabled:opacity-50 shrink-0"
                >
                  Restore
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Confirmation modal for sensitive keys */}
      {confirmOpen && pendingFd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="rounded-xl bg-white p-6 shadow-xl max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-semibold text-stone-900">Confirm change</p>
            <p className="mt-2 text-sm text-stone-600">
              You are changing{" "}
              <span className="font-medium">{s.label}</span> from{" "}
              <span className="font-mono bg-stone-100 px-1 rounded">{s.value}</span>{" "}
              to{" "}
              <span className="font-mono bg-amber-50 text-amber-800 px-1 rounded">
                {String(pendingFd.get("value"))}
              </span>
              .
            </p>
            <p className="mt-1 text-xs text-stone-400">
              This change takes effect immediately across the system.
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                Confirm Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
