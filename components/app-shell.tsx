"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { APP_BRAND, APP_BRAND_SHORT } from "@/lib/config";
import { signOut, setActAsRole } from "@/lib/auth/actions";

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
  children,
}: {
  modules: NavModule[];
  displayLabel: string;
  allRoleOptions: RoleOption[];
  actingAs: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1">
      {modules.length === 0 && (
        <p className="px-3 py-2 text-sm text-slate-500">
          No modules available for your role yet.
        </p>
      )}
      {modules.map((m) => {
        const active = pathname === m.path || pathname.startsWith(m.path + "/");
        return (
          <Link
            key={m.key}
            href={m.path}
            onClick={() => setOpen(false)}
            className={`rounded-lg px-3 py-2 transition ${
              active
                ? "bg-amber-50 text-amber-900"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <span className="flex items-center justify-between">
              <span className="font-medium">{m.label}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {m.milestone}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">{m.blurb}</span>
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-lg"
      >
        ☀️
      </span>
      <span className="font-bold tracking-tight text-slate-900">
        {APP_BRAND_SHORT}
      </span>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          >
            <MenuIcon />
          </button>
          {brand}
        </div>
        <div className="flex items-center gap-3">
          {allRoleOptions.length > 1 && (
            <select
              value={actingAs ?? "__all__"}
              onChange={async (e) => {
                const v = e.target.value;
                await setActAsRole(v === "__all__" ? null : v);
                router.push("/");
              }}
              title="View and act as one of your roles"
              className={`rounded-lg border px-2 py-1.5 text-sm focus:outline-none ${
                actingAs
                  ? "border-amber-400 bg-amber-50 text-amber-800"
                  : "border-slate-300 text-slate-700"
              }`}
            >
              <option value="__all__">All roles</option>
              {allRoleOptions.map((r) => (
                <option key={r.key} value={r.key}>
                  Act as: {r.label}
                </option>
              ))}
            </select>
          )}
          <span className="hidden text-sm font-medium text-slate-800 sm:inline">
            {displayLabel}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="no-print hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
          <div className="flex-1 overflow-y-auto p-3">{nav}</div>
          <div className="border-t border-slate-200 p-4">
            <p className="text-[11px] leading-relaxed text-slate-400">{APP_BRAND}</p>
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setOpen(false)}
            />
            <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white shadow-xl">
              <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
                {brand}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close navigation"
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                >
                  <CloseIcon />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">{nav}</div>
              <div className="border-t border-slate-200 p-4">
                <p className="text-[11px] leading-relaxed text-slate-400">
                  {APP_BRAND}
                </p>
              </div>
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
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
