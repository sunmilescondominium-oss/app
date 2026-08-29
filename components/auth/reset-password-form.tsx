"use client";

import { useActionState, useState } from "react";
import { updatePasswordAfterReset, type ResetState } from "@/lib/auth/actions";

const cls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function strengthLevel(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "bg-stone-200" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  else if (/[a-zA-Z]/.test(pw)) s += 0.5;
  if (/[0-9]/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: 1, label: "Weak", color: "bg-red-400" };
  if (s <= 2) return { score: 2, label: "Fair", color: "bg-amber-400" };
  if (s <= 3) return { score: 3, label: "Good", color: "bg-yellow-400" };
  return { score: 4, label: "Strong", color: "bg-emerald-500" };
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(updatePasswordAfterReset, undefined);
  const [pw, setPw] = useState("");
  const strength = strengthLevel(pw);

  return (
    <form action={action} className="mt-6 space-y-4">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-stone-700">New password</label>
        <input
          name="new_password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className={cls}
          placeholder="At least 8 characters + 1 number"
        />
        {pw && (
          <div className="mt-1.5 space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className={`h-1 flex-1 rounded-full transition-all ${n <= strength.score ? strength.color : "bg-stone-200"}`}
                />
              ))}
            </div>
            <p className="text-xs text-stone-500">
              {strength.label && <span className="font-medium">{strength.label} · </span>}
              Min 8 chars, at least 1 letter and 1 number
            </p>
          </div>
        )}
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
