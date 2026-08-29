"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveGuardAlert } from "./actions";

export function ResolveAlertButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function handleResolve() {
    start(async () => {
      await resolveGuardAlert(alertId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleResolve}
      disabled={pending}
      className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 whitespace-nowrap"
    >
      {pending ? "Resolving…" : "Resolve"}
    </button>
  );
}
