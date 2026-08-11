"use client";

import { useActionState, useTransition } from "react";

interface Props {
  action: (prev: unknown, formData: FormData) => Promise<{ error: string } | undefined>;
}

export function GiftCardLoginForm({ action }: Props) {
  const [state, formAction] = useActionState<{ error: string } | undefined, FormData>(
    action,
    undefined,
  );
  const [pending, startTransition] = useTransition();

  return (
    <form action={(fd) => startTransition(() => formAction(fd))} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Card number</label>
        <input
          name="card_code"
          required
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono uppercase"
          placeholder="GC-2026-001"
          autoComplete="off"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">PIN</label>
        <input
          name="pin"
          type="password"
          required
          minLength={4}
          maxLength={8}
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          placeholder="••••"
          autoComplete="current-password"
        />
      </div>
      {state?.error && (
        <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {pending ? "Checking…" : "View my card"}
      </button>
    </form>
  );
}
