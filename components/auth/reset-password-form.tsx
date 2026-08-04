"use client";

import { useActionState } from "react";
import { updatePasswordAfterReset, type ResetState } from "@/lib/auth/actions";

const cls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(updatePasswordAfterReset, undefined);

  return (
    <form action={action} className="mt-6 space-y-4">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-stone-700">New password</label>
        <input name="new_password" type="password" required minLength={8} autoComplete="new-password" className={cls} placeholder="At least 8 characters" />
      </div>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-stone-700">Confirm new password</label>
        <input name="confirm_password" type="password" required minLength={8} autoComplete="new-password" className={cls} />
      </div>
      {state?.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-amber-600 px-4 py-2.5 font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60">
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
