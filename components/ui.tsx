import Link from "next/link";
import { type ReactNode } from "react";

/** Presentational primitives (server-safe — no client hooks). */

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={`card p-5 sm:p-6 ${hover ? "card-hover" : ""} ${className}`}>
      {children}
    </div>
  );
}

type Tone = "brand" | "slate" | "green" | "amber" | "red" | "rose" | "indigo" | "blue";

const TONES: Record<Tone, string> = {
  brand: "bg-amber-100 text-amber-800 ring-amber-200",
  amber: "bg-amber-100 text-amber-800 ring-amber-200",
  slate: "bg-stone-100 text-stone-700 ring-stone-200",
  green: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  red: "bg-red-100 text-red-700 ring-red-200",
  rose: "bg-rose-100 text-rose-700 ring-rose-200",
  indigo: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  blue: "bg-blue-100 text-blue-800 ring-blue-200",
};

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Back navigation link — used to return to a dashboard or parent list. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="no-print group mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 transition hover:text-amber-700"
    >
      <span className="transition-transform group-hover:-translate-x-0.5">←</span>
      {children}
    </Link>
  );
}

export function PageHeader({
  title,
  subtitle,
  badge,
  eyebrow,
  backHref,
  backLabel = "Back to Dashboard",
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-6">
      {backHref && <BackLink href={backHref}>{backLabel}</BackLink>}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200/80 pb-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-700">{eyebrow}</p>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-[1.75rem]">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{subtitle}</p>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
    </div>
  );
}

/** Compact metric tile for dashboards / summaries. */
export function StatCard({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "slate" | "green" | "amber" | "rose" | "indigo";
}) {
  const accent: Record<string, string> = {
    slate: "text-stone-900",
    green: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
    indigo: "text-indigo-700",
  };
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-stone-400">{hint}</p>}
    </div>
  );
}

type BtnVariant = "primary" | "ghost" | "danger";

const BTN: Record<BtnVariant, string> = {
  primary: "bg-amber-600 text-white shadow-sm hover:bg-amber-700 hover:shadow-md",
  ghost: "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50",
  danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700",
};

/** Link styled as a button. */
export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: BtnVariant;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${BTN[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
