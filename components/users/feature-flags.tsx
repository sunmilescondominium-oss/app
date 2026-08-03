"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setFeatureFlag } from "@/app/(app)/users/access/flag-actions";

export interface FlagRow { key: string; label: string; enabled: boolean; updated_by_role: string | null }

function Toggle({ flag }: { flag: FlagRow }) {
  const router = useRouter();
  const [on, setOn] = useState(flag.enabled);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const flip = () => {
    const next = !on;
    setOn(next);
    setErr(null);
    start(async () => {
      const res = await setFeatureFlag(flag.key, next);
      if (!res.ok) { setOn(!next); setErr(res.error); }
      else router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-4">
      <div>
        <p className="font-medium text-stone-800">{flag.label}</p>
        <p className="text-xs text-stone-400">
          {on ? "Enabled — visible to its roles." : "Disabled — hidden from everyone."}
          {flag.updated_by_role ? ` · last set by ${flag.updated_by_role.replace(/_/g, " ")}` : ""}
        </p>
        {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={pending}
        onClick={flip}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60 ${on ? "bg-emerald-500" : "bg-stone-300"}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${on ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

export function FeatureFlags({ flags }: { flags: FlagRow[] }) {
  return (
    <div className="space-y-2">
      {flags.map((f) => <Toggle key={f.key} flag={f} />)}
    </div>
  );
}
