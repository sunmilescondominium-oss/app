import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { accessibleModules, MODULES, type ModuleDef } from "@/lib/rbac/modules";
import { Breadcrumb, PageHeader } from "@/components/ui";

export const metadata = { title: "Help & Documentation" };

// Whats new — newest first. Matches milestone label so the badge is consistent.
const WHATS_NEW: { key: string; date: string; summary: string }[] = [
  {
    key: "pmt_requests",
    date: "Sep 2026",
    summary:
      "Accounting creates a secure, passcode-protected link for a requestor to fill in their payment details. Once submitted, accounting reviews and approves or rejects the request with a note. On approval, releasing the budget automatically records the expense in P&L and sends a chat notification to the requestor.",
  },
  {
    key: "expenses",
    date: "Aug 2026",
    summary:
      "Record general/admin expenses against bank account or petty cash. Supports category and vendor management, CSV bulk import, and direct P&L integration.",
  },
  {
    key: "petty_cash",
    date: "Aug 2026",
    summary:
      "Manage petty cash funds: load from bank, disburse with PCV vouchers, and view running balances per fund.",
  },
];

// Group modules into logical sections for the reference table
const GROUPS: { label: string; keys: string[] }[] = [
  {
    label: "Finance & Accounting",
    keys: ["finance", "expenses", "petty_cash", "pmt_requests", "banking", "advances", "accountable_forms", "payables", "collections", "transmittals"],
  },
  {
    label: "Hotel & Rentals",
    keys: ["hotel", "housekeeping", "rentals", "condo"],
  },
  {
    label: "Property & Sales",
    keys: ["buyers", "documents", "disputes", "inventory", "requisitions"],
  },
  {
    label: "People & HR",
    keys: ["employees", "employee", "hr", "scheduling", "advances"],
  },
  {
    label: "Operations",
    keys: ["repair", "incidents", "guard"],
  },
  {
    label: "Admin & System",
    keys: ["users", "settings", "chat"],
  },
];

export default async function DocsPage() {
  const user = await requireModule("docs");
  const myModules = accessibleModules(user.roleKeys);
  const myKeys = new Set(myModules.map((m) => m.key));

  // Filter whats-new to only modules this user can see
  const visibleNew = WHATS_NEW.filter((n) => myKeys.has(n.key as never));

  return (
    <>
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Help & Docs" }]} />
      <PageHeader
        title="Help & Documentation"
        subtitle="Module reference, quick links, and release notes for the Sun Miles PMS."
      />

      {/* ── What's New ─────────────────────────────────────────── */}
      {visibleNew.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-emerald-700">
            What&rsquo;s New
          </h2>
          <div className="space-y-3">
            {visibleNew.map((n) => {
              const mod = MODULES[n.key as keyof typeof MODULES];
              return (
                <div
                  key={n.key}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                        New
                      </span>
                      <span className="font-semibold text-stone-800">{mod?.label}</span>
                      <span className="text-xs text-stone-400">{n.date}</span>
                    </div>
                    {mod && myKeys.has(n.key as never) && (
                      <Link
                        href={mod.path}
                        className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Open module →
                      </Link>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-stone-600">{n.summary}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Module Quick Access ─────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-stone-500">
          Your Modules
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {myModules.map((mod) => (
            <ModuleCard key={mod.key} mod={mod} isNew={WHATS_NEW.some((n) => n.key === mod.key)} />
          ))}
        </div>
      </section>

      {/* ── Full Module Reference ───────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-stone-500">
          Module Reference
        </h2>
        <div className="space-y-6">
          {GROUPS.map((group) => {
            const mods = group.keys
              .filter((k, i, arr) => arr.indexOf(k) === i) // dedupe
              .map((k) => MODULES[k as keyof typeof MODULES])
              .filter(Boolean) as ModuleDef[];
            if (mods.length === 0) return null;
            return (
              <div key={group.label}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400">
                  {group.label}
                </h3>
                <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
                        <th className="px-4 py-2 text-left">Module</th>
                        <th className="px-4 py-2 text-left">Description</th>
                        <th className="px-4 py-2 text-left">Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {mods.map((mod) => {
                        const canAccess = myKeys.has(mod.key);
                        return (
                          <tr key={mod.key} className={canAccess ? "" : "opacity-40"}>
                            <td className="whitespace-nowrap px-4 py-2.5 font-medium text-stone-800">
                              {canAccess ? (
                                <Link
                                  href={mod.path}
                                  className="text-emerald-700 underline-offset-2 hover:underline"
                                >
                                  {mod.label}
                                </Link>
                              ) : (
                                <span>{mod.label}</span>
                              )}
                              {WHATS_NEW.some((n) => n.key === mod.key) && (
                                <span className="ml-1.5 inline-flex rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                  NEW
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-stone-600">{mod.blurb}</td>
                            <td className="px-4 py-2.5">
                              {canAccess ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                  Accessible
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-400">
                                  No access
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Payment Requests Workflow Guide ────────────────────── */}
      {myKeys.has("pmt_requests") && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-stone-500">
            Payment Requests — How It Works
          </h2>
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <ol className="space-y-4 text-sm text-stone-700">
              {[
                {
                  step: "Accounting creates the form",
                  detail:
                    'In Payment Requests, click “+ New payment request form”. Fill in the requestor, payee name, purpose, budget source (bank account or petty cash fund), expiry date, and payment type (check or petty cash).',
                },
                {
                  step: "Send the secure link",
                  detail:
                    "A unique link is generated. Copy it and share it verbally or via chat with the requestor. The link expires on the date you set.",
                },
                {
                  step: "Requestor unlocks and submits",
                  detail:
                    "The requestor opens the link, enters their system passcode to verify their identity, then fills in the description, amount, and optional supporting document. They re-enter their passcode to confirm submission.",
                },
                {
                  step: "Accounting reviews",
                  detail:
                    'The request appears under "Submitted - needs review". Approve with a note or reject with a reason. A chat notification is automatically sent to the requestor either way.',
                },
                {
                  step: "Budget release",
                  detail:
                    'Once approved and the fund is physically ready (check cleared or cash counted), click "Release Budget". The system automatically records the expense in General Expenses (P&L) and sends the requestor a chat notification.',
                },
              ].map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-stone-800">{item.step}</p>
                    <p className="mt-0.5 text-stone-500">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex justify-end">
              <Link
                href="/pmt-requests"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Go to Payment Requests →
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function ModuleCard({ mod, isNew }: { mod: ModuleDef; isNew: boolean }) {
  return (
    <Link
      href={mod.path}
      className="group block rounded-2xl border border-stone-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-stone-800 group-hover:text-emerald-700">{mod.label}</p>
        {isNew && (
          <span className="shrink-0 inline-flex rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
            NEW
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-stone-500">{mod.blurb}</p>
    </Link>
  );
}
