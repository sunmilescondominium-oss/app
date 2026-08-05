"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { localizeGuide, type RoleGuide } from "@/lib/guides/role-guides";
import { t, type Lang } from "@/lib/i18n";

/**
 * Role Launch Pad — the "what do I do" panel at the top of the dashboard.
 * Collapsible and remembers the choice per browser, so it guides new staff
 * without nagging power users.
 */
export function LaunchPad({ guides, lang = "en" }: { guides: RoleGuide[]; lang?: Lang }) {
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const localized = guides.map((g) => localizeGuide(g, lang));

  useEffect(() => {
    setOpen(localStorage.getItem("launchpad_collapsed") !== "1");
    setReady(true);
  }, []);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      localStorage.setItem("launchpad_collapsed", next ? "0" : "1");
      return next;
    });
  };

  if (!ready) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/60">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-900">
          <span aria-hidden>🧭</span> {t(lang, "lp_how_to")}
        </span>
        <span className={`text-amber-700 transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      {open && (
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
          {localized.map((g) => (
            <div key={g.role} className="rounded-xl border border-amber-100 bg-white/80 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-800">
                <span aria-hidden className="text-base">{g.icon}</span> {g.headline}
              </p>
              <ol className="space-y-1.5">
                {g.steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-stone-600">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-800">{i + 1}</span>
                    {s.href ? (
                      <Link href={s.href} className="transition hover:text-amber-700 hover:underline">{s.text}</Link>
                    ) : (
                      <span>{s.text}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
