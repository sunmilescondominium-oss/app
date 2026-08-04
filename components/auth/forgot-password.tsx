"use client";

import { useActionState, useState } from "react";
import { requestPasswordReset, type ResetState } from "@/lib/auth/actions";

const cls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function ForgotPassword() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ResetState, FormData>(requestPasswordReset, undefined);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-4 block w-full text-center text-sm font-medium text-amber-700 hover:underline">
        Forgot password?
      </button>
    );
  }

  if (state?.sent) {
    return (
      <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm text-emerald-700">
        If that email is registered, a reset link is on its way. Check your inbox (and spam).
      </p>
    );
  }

  return (
    <form action={action} className="mt-4 space-y-2 rounded-lg border border-stone-200 bg-stone-50/60 p-3">
      <label className="block text-xs font-medium text-stone-600">Reset your password — enter your email</label>
      <input name="email" type="email" required autoComplete="email" placeholder="you@sunmiles.ph" className={cls} />
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {pending ? "Sending…" : "Send reset link"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-stone-500 hover:underline">Cancel</button>
      </div>
    </form>
  );
}
