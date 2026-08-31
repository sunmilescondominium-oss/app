"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { APP_BRAND, APP_BRAND_SHORT } from "@/lib/config";
import { signOut, setActAsRole } from "@/lib/auth/actions";
import { LanguageToggle } from "@/components/language-toggle";
import { exitImpersonation } from "@/app/(app)/users/impersonate-actions";
import { SunMilesMark } from "@/components/brand-logo";
import { t, navLabel, navBlurb, type Lang } from "@/lib/i18n";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { setDemoMode } from "@/lib/auth/actions";
import { clearDemoData } from "@/app/(app)/hotel/actions";

export interface NavModule {
  key: string;
  path: string;
  label: string;
  blurb: string;
  milestone: string;
}

export interface RoleOption {
  key: string;
  label: string;
}

export function AppShell({
  modules,
  displayLabel,
  allRoleOptions,
  actingAs,
  impersonating = false,
  demoMode = false,
  lang = "en",
  commitSha = null,
  isSuperUser = false,
  unreadNotifications = 0,
  children,
}: {
  modules: NavModule[];
  displayLabel: string;
  allRoleOptions: RoleOption[];
  actingAs: string | null;
  impersonating?: boolean;
  demoMode?: boolean;
  lang?: Lang;
  commitSha?: string | null;
  isSuperUser?: boolean;
  unreadNotifications?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [endingDemo, setEndingDemo] = useState(false);
  const tr = (k: string) => t(lang, k);

  async function handleEndDemo() {
    setEndingDemo(true);
    await clearDemoData();
    await setDemoMode(false);
    router.refresh();
    setEndingDemo(false);
  }

  const linkCls = (active: boolean) =>
    `group relative block rounded-xl px-3 py-2.5 transition ${
      active
        ? "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200"
        : "text-stone-600 hover:bg-stone-100/80 hover:text-stone-900"
    }`;

  const nav = (
    <nav className="flex flex-col gap-0.5">
      <Link href="/dashboard" onClick={() => setOpen(false)} className={linkCls(pathname === "/dashboard")}>
        {pathname === "/dashboard" && <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-amber-500" />}
        <span className="font-semibold">{navLabel(lang, "dashboard", "🏠 Dashboard")}</span>
        <span className="mt-0.5 block text-xs text-stone-400">{navBlurb(lang, "dashboard", "Your role overview")}</span>
      </Link>
      {modules.length === 0 && (
        <p className="px-3 py-2 text-sm text-stone-500">{tr("no_modules")}</p>
      )}
      {modules.map((m) => {
        const active = pathname === m.path || pathname.startsWith(m.path + "/");
        return (
          <Link key={m.key} href={m.path} onClick={() => setOpen(false)} className={linkCls(active)}>
            {active && <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-amber-500" />}
            <span className="flex items-center justify-between">
              <span className="font-semibold">{m.label}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-300">{m.milestone}</span>
            </span>
            <span className="mt-0.5 block text-xs text-stone-400">{m.blurb}</span>
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white ring-1 ring-stone-200"
      >
        <SunMilesMark className="h-7 w-7" />
      </span>
      <span className="font-bold tracking-tight text-stone-900">
        {APP_BRAND_SHORT}
      </span>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {impersonating && (
        <div className="no-print sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 bg-rose-600 px-4 py-2 text-center text-sm font-medium text-white">
          <span>👁️ {tr("signed_in_as")} <strong>{displayLabel}</strong> ({tr("impersonating")})</span>
          <form action={exitImpersonation}>
            <button type="submit" className="rounded-md bg-white/20 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/40 hover:bg-white/30">
              {tr("exit_to_account")}
            </button>
          </form>
        </div>
      )}
      <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-stone-200/80 bg-white/80 px-4 backdrop-blur-md md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 md:hidden"
          >
            <MenuIcon />
          </button>
          {brand}
        </div>
        <div className="flex items-center gap-2.5">
          {allRoleOptions.length > 0 && (
            <select
              value={actingAs ?? "__all__"}
              onChange={async (e) => {
                const v = e.target.value;
                await setActAsRole(v === "__all__" ? null : v);
                // Hard-navigate so the server re-runs the layout and recomputes
                // the role-filtered nav from the updated cookie.
                window.location.href = "/dashboard";
              }}
              title="View and act as one of your roles"
              className={`rounded-lg border px-2.5 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-amber-200 ${
                actingAs
                  ? "border-amber-400 bg-amber-50 text-amber-800"
                  : "border-stone-300 text-stone-700 hover:bg-stone-50"
              }`}
            >
              <option value="__all__">{tr("all_roles")}</option>
              {allRoleOptions.map((r) => (
                <option key={r.key} value={r.key}>
                  {tr("act_as")}: {r.label}
                </option>
              ))}
            </select>
          )}
          {actingAs && !demoMode && (
            <button
              type="button"
              title="Turn on demo mode for this role"
              onClick={async () => {
                await setDemoMode(true);
                window.location.reload();
              }}
              className="rounded-lg border border-stone-300 px-2.5 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
            >
              🎭 Demo
            </button>
          )}
          {demoMode && (
            <button
              type="button"
              title="End demo — wipe demo data and return to normal mode"
              onClick={handleEndDemo}
              disabled={endingDemo}
              className="rounded-lg border border-rose-500 bg-rose-600 px-2.5 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-60"
            >
              {endingDemo ? "…" : "🛑 End Demo"}
            </button>
          )}
          <NotificationBell unread={unreadNotifications} />
          <LanguageToggle />
          <span className="hidden text-sm font-medium text-stone-700 sm:inline">
            {displayLabel}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 active:scale-[0.98]"
            >
              {tr("sign_out")}
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="no-print hidden w-72 shrink-0 flex-col border-r border-stone-200/80 bg-white/60 md:flex">
          <div className="flex-1 overflow-y-auto p-3">{nav}</div>
          <div className="border-t border-stone-200/80 p-4">
            <p className="text-[11px] leading-relaxed text-stone-400">{APP_BRAND}</p>
            {isSuperUser && commitSha && (
              <p className="mt-0.5 font-mono text-[10px] text-stone-300" title="Deployed commit">
                build {commitSha}
              </p>
            )}
            <a href="/help" className="mt-2 inline-block text-[11px] font-medium text-stone-400 hover:text-amber-700 hover:underline">
              Help →
            </a>
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white shadow-2xl">
              <div className="flex h-16 items-center justify-between border-b border-stone-200/80 px-4">
                {brand}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation"
                  className="rounded-lg p-2 text-stone-600 hover:bg-stone-100"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">{nav}</div>
              <div className="border-t border-stone-200/80 p-4">
                <p className="text-[11px] leading-relaxed text-stone-400">{APP_BRAND}</p>
                <a href="/help" className="mt-2 inline-block text-[11px] font-medium text-stone-400 hover:text-amber-700 hover:underline">
                  Help →
                </a>
              </div>
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
          <div className="animate-rise mx-auto w-full max-w-5xl">
            {demoMode && (
              <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-purple-400 bg-purple-50 px-4 py-2.5 text-sm">
                <span className="font-semibold text-purple-900">
                  🎭 Demo Mode — ghost rooms only · data wiped on End Demo
                </span>
                <button
                  type="button"
                  onClick={handleEndDemo}
                  disabled={endingDemo}
                  className="rounded-lg border border-rose-500 bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {endingDemo ? "Ending…" : "🛑 End Demo"}
                </button>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
