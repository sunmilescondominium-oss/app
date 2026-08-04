"use client";

import { useActionState } from "react";
import { changeMyPassword, changeMyEmail, changeMyPin, type AccountResult } from "@/app/(app)/me/actions";

const cls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function Note({ state }: { state: AccountResult | undefined }) {
  if (!state) return null;
  return state.ok ? (
    <p className="text-sm text-emerald-700">{state.message ?? "Saved."}</p>
  ) : (
    <p className="text-sm text-red-700">{state.error}</p>
  );
}

export function AccountPanel({ currentEmail }: { currentEmail: string | null }) {
  const [pwState, pwAction, pwPending] = useActionState<AccountResult | undefined, FormData>(changeMyPassword, undefined);
  const [emState, emAction, emPending] = useActionState<AccountResult | undefined, FormData>(changeMyEmail, undefined);
  const [pinState, pinAction, pinPending] = useActionState<AccountResult | undefined, FormData>(changeMyPin, undefined);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Password */}
      <form action={pwAction} className="rounded-2xl border border-stone-200 bg-white p-5">
        <p className="mb-2 text-sm font-semibold text-stone-800">Change password</p>
        <label className="mb-1 block text-xs font-medium text-stone-500">New password
          <input name="new_password" type="password" required minLength={8} autoComplete="new-password" className={`${cls} mt-1`} />
        </label>
        <label className="mb-2 block text-xs font-medium text-stone-500">Confirm new password
          <input name="confirm_password" type="password" required minLength={8} autoComplete="new-password" className={`${cls} mt-1`} />
        </label>
        <button type="submit" disabled={pwPending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {pwPending ? "Updating…" : "Update password"}
        </button>
        <div className="mt-2"><Note state={pwState} /></div>
      </form>

      {/* Email */}
      <form action={emAction} className="rounded-2xl border border-stone-200 bg-white p-5">
        <p className="mb-2 text-sm font-semibold text-stone-800">Change email</p>
        <p className="mb-2 text-xs text-stone-400">Current: <span className="font-medium text-stone-600">{currentEmail ?? "—"}</span></p>
        <label className="mb-2 block text-xs font-medium text-stone-500">New email
          <input name="new_email" type="email" required autoComplete="email" className={`${cls} mt-1`} />
        </label>
        <button type="submit" disabled={emPending} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60">
          {emPending ? "Sending…" : "Request email change"}
        </button>
        <div className="mt-2"><Note state={emState} /></div>
        <p className="mt-2 text-[11px] text-stone-400">You&rsquo;ll get a confirmation link to verify the new address.</p>
      </form>

      {/* Attendance-kiosk PIN */}
      <form action={pinAction} className="rounded-2xl border border-stone-200 bg-white p-5 sm:col-span-2">
        <p className="mb-2 text-sm font-semibold text-stone-800">Change my attendance-kiosk PIN</p>
        <p className="mb-2 text-xs text-stone-400">Used to clock in/out at the kiosk with your employee ID. The default is <strong>0000</strong> — change it to something only you know.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-medium text-stone-500">New PIN (4–8 digits)
            <input name="new_pin" inputMode="numeric" pattern="\d*" required minLength={4} maxLength={8} className={`${cls} mt-1`} />
          </label>
          <label className="text-xs font-medium text-stone-500">Confirm PIN
            <input name="confirm_pin" inputMode="numeric" pattern="\d*" required minLength={4} maxLength={8} className={`${cls} mt-1`} />
          </label>
        </div>
        <button type="submit" disabled={pinPending} className="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {pinPending ? "Updating…" : "Update PIN"}
        </button>
        <div className="mt-2"><Note state={pinState} /></div>
      </form>
    </div>
  );
}
