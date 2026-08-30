"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateGuardProfile } from "@/app/(app)/guard/actions";
import type { GuardAccountRow } from "@/lib/guard/queries";

export function GuardAccountEditor({ guard }: { guard: GuardAccountRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [agency, setAgency] = useState(guard.guardAgency ?? "");
  const [position, setPosition] = useState(guard.guardPosition ?? "");
  const [operation, setOperation] = useState<"hotel" | "condo" | "">(guard.guardOperation ?? "");
  const [expires, setExpires] = useState(
    guard.guardContractExpiresAt
      ? guard.guardContractExpiresAt.slice(0, 10)
      : "",
  );
  const [error, setError] = useState("");
  const [busy, start] = useTransition();

  function save() {
    setError("");
    if (!operation) { setError("Operation area is required — select Hotel or Condo."); return; }
    start(async () => {
      const result = await updateGuardProfile(guard.userId, {
        guardAgency: agency,
        guardPosition: position,
        guardContractExpiresAt: expires ? `${expires}T23:59:59+08:00` : null,
        guardOperation: operation || null,
      });
      if (!result.ok) { setError(result.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  const inputCls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-sm font-bold text-stone-900">
              Edit — {guard.displayLabel}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-600">Operation area</label>
                <select
                  value={operation}
                  onChange={(e) => setOperation(e.target.value as "hotel" | "condo" | "")}
                  className={inputCls}
                >
                  <option value="">— not assigned —</option>
                  <option value="hotel">Hotel Operations</option>
                  <option value="condo">Condo Operations</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-600">Agency name</label>
                <input
                  type="text"
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  placeholder="e.g. Sun Miles Security Agency"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-600">Position</label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. Security Guard"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-stone-600">
                  Contract expiry date (Manila)
                </label>
                <input
                  type="date"
                  value={expires}
                  onChange={(e) => setExpires(e.target.value)}
                  className={inputCls}
                />
                <p className="mt-0.5 text-[10px] text-stone-400">
                  Access is blocked after this date. Leave blank for no expiry.
                </p>
              </div>
            </div>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="flex-1 rounded-lg bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-900 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
