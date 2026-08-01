"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  buildTransmittalForDate,
  type ActionResult,
} from "@/app/(app)/transmittals/actions";

export function BuildTransmittalForm({ defaultDate }: { defaultDate: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(buildTransmittalForDate, undefined);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form
      action={action}
      className="no-print mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Build transmittal for date
        </label>
        <input
          type="date"
          name="date"
          defaultValue={defaultDate}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {pending ? "Building…" : "Build transmittal"}
      </button>
      <p className="w-full text-xs text-slate-500">
        Bundles all un-transmitted collections for that date into one transmittal.
      </p>
      {state && !state.ok && (
        <p className="w-full text-sm text-red-700">{state.error}</p>
      )}
    </form>
  );
}
