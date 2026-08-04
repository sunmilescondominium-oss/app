"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createEmployee, type ActionResult } from "@/app/(app)/employees/actions";

const cls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export interface RoleOpt { key: string; label: string }

export function AddEmployee({ roles }: { roles: RoleOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, act, pending] = useActionState<ActionResult | undefined, FormData>(createEmployee, undefined);
  useEffect(() => { if (state?.ok) { router.refresh(); setOpen(false); } }, [state, router]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700">
        + Add employee
      </button>
    );
  }

  return (
    <form action={act} className="grid gap-2 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
      <p className="text-sm font-semibold text-stone-700 sm:col-span-2">Add employee (creates the account + role)</p>
      <label className="text-xs font-medium text-stone-500">Display label (role / position)
        <input name="display_label" required placeholder="e.g. Room Attendant 1" className={`${cls} mt-1`} />
      </label>
      <label className="text-xs font-medium text-stone-500">Role
        <select name="role" required defaultValue="" className={`${cls} mt-1`}>
          <option value="" disabled>Choose role…</option>
          {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-stone-500">Login email
        <input name="email" type="email" required placeholder="staff@sunmiles…" className={`${cls} mt-1`} />
      </label>
      <label className="text-xs font-medium text-stone-500">Temporary password
        <input name="password" type="text" required minLength={6} placeholder="min 6 chars" className={`${cls} mt-1`} />
      </label>
      <div className="flex items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {pending ? "Creating…" : "Create employee"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-stone-500 hover:underline">Cancel</button>
        {state && !state.ok && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
      <p className="text-xs text-stone-400 sm:col-span-2">After creating, open their row to fill the 201 file (details, documents, photo). No personal name is required — use a role-based label.</p>
    </form>
  );
}
