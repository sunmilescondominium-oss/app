"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { unlockKiosk } from "@/app/(public)/attendance-portal/actions";

export function KioskGate() {
  const router = useRouter();
  const [state, action, pending] = useActionState(unlockKiosk, undefined);
  useEffect(() => {
    if (state === undefined) return;
  }, [state]);

  return (
    <form
      action={async (fd) => {
        await action(fd);
        router.refresh();
      }}
      className="mx-auto mt-16 max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-800">Kiosk locked</h2>
      <p className="mt-1 text-sm text-slate-500">Enter the access code to use this device as an attendance kiosk.</p>
      <input
        name="access_code"
        type="password"
        placeholder="Access code"
        className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-3 w-full rounded-lg bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {pending ? "Unlocking…" : "Unlock"}
      </button>
      {state?.error && <p className="mt-2 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
