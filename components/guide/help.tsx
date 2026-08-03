import { type ReactNode } from "react";

/**
 * "How this works" panel — a collapsible, plain-language step list for complex
 * flows. Server-safe (native <details>, no JS). Drop it at the top of a screen
 * whose process isn't obvious.
 */
export function HelpPanel({
  title = "How this works",
  steps,
  children,
  defaultOpen = false,
}: {
  title?: string;
  steps?: string[];
  children?: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="no-print mb-4 rounded-xl border border-sky-200 bg-sky-50/70">
      <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-semibold text-sky-800 marker:content-none">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-200 text-xs font-bold text-sky-800">?</span>
          {title}
        </span>
      </summary>
      <div className="px-4 pb-4 pt-1 text-sm text-stone-700">
        {steps && (
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-sky-700 ring-1 ring-sky-200">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}
        {children}
      </div>
    </details>
  );
}

/** Tiny inline hint — a "?" with a tooltip for a single confusing field/label. */
export function HelpTip({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-stone-200 text-[10px] font-bold text-stone-600 align-middle"
      aria-label={text}
    >
      ?
    </span>
  );
}
