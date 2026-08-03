"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateComputationParam } from "@/app/(app)/buyers/actions";
import type { ComputationParam } from "@/lib/buyers/types";

export function ParamsEditor({
  params,
  onDone,
}: {
  params: ComputationParam[];
  onDone: () => void;
}) {
  const router = useRouter();
  const editable = params.filter((p) => p.key !== "params_version");
  const version = params.find((p) => p.key === "params_version")?.value ?? 1;

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(editable.map((p) => [p.key, String(p.value)])),
  );
  const [busy, setBusy] = useState<string | null>(null);

  async function save(p: ComputationParam) {
    const v = Number(values[p.key]);
    if (!Number.isFinite(v)) {
      window.alert("Enter a valid number.");
      return;
    }
    setBusy(p.key);
    const res = await updateComputationParam(p.key, v);
    setBusy(null);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">
        Current version: <strong>v{version}</strong>. Saving a value bumps the
        version. Existing SOAs keep their snapshot — regenerate a buyer&apos;s SOA
        to apply new values.
      </p>
      <div className="space-y-2">
        {editable.map((p) => (
          <div key={p.key} className="flex items-center gap-2">
            <div className="flex-1">
              <p className="text-sm font-medium text-stone-800">{p.label ?? p.key}</p>
              <p className="text-[11px] text-stone-400">{p.key}</p>
            </div>
            <input
              value={values[p.key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [p.key]: e.target.value }))
              }
              className="w-28 rounded-lg border border-stone-300 px-2 py-1 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
            />
            <button
              type="button"
              onClick={() => save(p)}
              disabled={busy === p.key}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          Close
        </button>
      </div>
    </div>
  );
}
