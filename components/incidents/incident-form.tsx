"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createIncident, resolveIncident, type ActionResult } from "@/app/(app)/incidents/actions";

const cls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
const CATEGORIES = [
  { v: "security", l: "Security" },
  { v: "safety", l: "Safety" },
  { v: "damage", l: "Damage" },
  { v: "other", l: "Other" },
];

export function IncidentForm() {
  const router = useRouter();
  const [state, act, pending] = useActionState<ActionResult | undefined, FormData>(createIncident, undefined);
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);

  return (
    <form action={act} className="mb-6 grid gap-2 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
      <p className="text-sm font-semibold text-stone-700 sm:col-span-2">Report an incident</p>
      <label className="text-xs font-medium text-stone-500 sm:col-span-2">Title
        <input name="title" required placeholder="e.g. Broken gate lock at Block B" className={`${cls} mt-1`} />
      </label>
      <label className="text-xs font-medium text-stone-500">Category
        <select name="category" defaultValue="security" className={`${cls} mt-1`}>
          {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-stone-500">Location
        <input name="location" placeholder="Where did it happen?" className={`${cls} mt-1`} />
      </label>
      <label className="text-xs font-medium text-stone-500 sm:col-span-2">Description
        <textarea name="description" rows={2} className={`${cls} mt-1`} />
      </label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {pending ? "Logging…" : "Log incident"}
        </button>
        {state && !state.ok && <span className="ml-2 text-sm text-red-700">{state.error}</span>}
        <span className="ml-2 text-xs text-stone-400">Add live photos to it below once logged.</span>
      </div>
    </form>
  );
}

export function ResolveToggle({ id, resolved }: { id: string; resolved: boolean }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => { await resolveIncident(id, !resolved); router.refresh(); }}
      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${resolved ? "border-stone-300 text-stone-600 hover:bg-stone-50" : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
    >
      {resolved ? "Reopen" : "Mark resolved"}
    </button>
  );
}
