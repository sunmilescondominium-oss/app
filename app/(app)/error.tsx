"use client";

import { useEffect } from "react";

/**
 * Segment error boundary for the authenticated app. Turns an otherwise blank
 * page into a readable message + retry, and shows the error digest so a
 * server-side exception can be traced in the logs.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("App segment error:", error);
  }, [error]);

  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
      <p className="text-2xl">⚠️</p>
      <h1 className="mt-2 text-lg font-semibold text-rose-900">Something went wrong on this page</h1>
      <p className="mt-1 text-sm text-rose-800">
        The page hit an error and couldn&apos;t load. You can try again, or head back to the dashboard.
      </p>
      {error.message && (
        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-white/70 px-3 py-2 text-left text-xs text-rose-900">
          {error.message}
        </pre>
      )}
      {error.digest && <p className="mt-2 text-[11px] text-rose-500">Reference: {error.digest}</p>}
      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
