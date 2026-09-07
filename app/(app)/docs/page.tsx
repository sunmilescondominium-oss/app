import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { accessibleModules, MODULES, type ModuleDef } from "@/lib/rbac/modules";
import { Breadcrumb, PageHeader } from "@/components/ui";

export const metadata = { title: "Help & Docs" };

// ── What's New entries — shown at the top, newest first ──────────────────────
// kind: "new" | "fixed" | "improved"
const WHATS_NEW: { key: string; kind: "new" | "fixed" | "improved"; date: string; summary: string }[] = [
  {
    key: "expenses",
    kind: "fixed",
    date: "Sep 7, 2026",
    summary: 'Fixed: recording an expense showed an error about a missing "actor_role" column. The issue is resolved — expenses record correctly now.',
  },
  {
    key: "pmt_requests",
    kind: "new",
    date: "Sep 2026",
    summary:
      "Payment Requests — accounting creates a secure, passcode-protected link for a requestor. After submission, accounting reviews and approves or rejects. Releasing the budget auto-records the expense and sends a chat notification.",
  },
  {
    key: "expenses",
    kind: "new",
    date: "Aug 2026",
    summary:
      "General Expenses — record admin/operational expenses against a bank account or petty cash fund, with category and vendor management plus CSV bulk import.",
  },
  {
    key: "petty_cash",
    kind: "new",
    date: "Aug 2026",
    summary:
      "Petty Cash — manage fund balances, load cash from bank, and disburse with PCV vouchers.",
  },
];

const KIND_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  new:      { bg: "bg-emerald-600", text: "text-white", label: "New" },
  fixed:    { bg: "bg-amber-500",   text: "text-white", label: "Fixed" },
  improved: { bg: "bg-blue-600",    text: "text-white", label: "Improved" },
};

// ── Module reference groups ───────────────────────────────────────────────────
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
    keys: ["users", "settings", "chat", "docs", "changelog"],
  },
];

// ── Inline link helper ────────────────────────────────────────────────────────
function ML({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-emerald-700 underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

export default async function DocsPage() {
  const user = await requireModule("docs");
  const myModules = accessibleModules(user.roleKeys);
  const myKeys = new Set(myModules.map((m) => m.key));

  // Deduplicate what's-new by key+kind so the "expenses" fix and "expenses" new appear once each
  const seen = new Set<string>();
  const visibleNew = WHATS_NEW.filter((n) => {
    const id = `${n.key}:${n.kind}:${n.date}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return myKeys.has(n.key as never);
  });

  return (
    <>
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Help & Docs" }]} />
      <PageHeader
        title="Help & Documentation"
        subtitle="Module guides, quick links, and workflow references for Sun Miles PMS staff."
      />

      {/* ── Top bar: changelog link ─────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
        <p className="text-sm text-stone-600">
          Looking for release notes?{" "}
          <Link href="/changelog" className="font-semibold text-emerald-700 underline-offset-2 hover:underline">
            View the full changelog →
          </Link>
        </p>
        <span className="text-xs text-stone-400">v1.31 · Sep 2026</span>
      </div>

      {/* ── What's New ─────────────────────────────────────────── */}
      {visibleNew.length > 0 && (
        <section className="mb-8" id="whats-new">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-emerald-700">
            What&rsquo;s New &amp; Recently Fixed
          </h2>
          <div className="space-y-3">
            {visibleNew.map((n, i) => {
              const mod = MODULES[n.key as keyof typeof MODULES];
              const badge = KIND_BADGE[n.kind] ?? KIND_BADGE.new;
              return (
                <div key={i} className="rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      <span className="font-semibold text-stone-800">{mod?.label}</span>
                      <span className="text-xs text-stone-400">{n.date}</span>
                    </div>
                    {mod && myKeys.has(n.key as never) && n.kind !== "fixed" && (
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
      <section className="mb-8" id="modules">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-stone-500">
          Your Modules
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {myModules.map((mod) => (
            <ModuleCard
              key={mod.key}
              mod={mod}
              badge={WHATS_NEW.find((n) => n.key === mod.key)?.kind}
            />
          ))}
        </div>
      </section>

      {/* ── Workflow Guides ─────────────────────────────────────── */}
      <section className="mb-8 space-y-6" id="guides">
        <h2 className="text-sm font-bold uppercase tracking-widest text-stone-500">
          Workflow Guides
        </h2>

        {/* Payment Requests */}
        {myKeys.has("pmt_requests") && (
          <article id="guide-pmt-requests" className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-stone-800">
                <ML href="/pmt-requests">Payment Requests</ML> — How It Works
              </h3>
              <Link href="/pmt-requests" className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                Open module →
              </Link>
            </div>
            <ol className="space-y-4 text-sm text-stone-700">
              <WorkflowStep n={1} title="Accounting creates the form">
                In <ML href="/pmt-requests">Payment Requests</ML>, click{" "}
                <strong>+ New payment request form</strong>. Fill in the requestor (any staff
                member), payee name, purpose, expiry date, payment type (check or petty cash),
                and primary budget source — a{" "}
                <ML href="/banking">bank account</ML> or a{" "}
                <ML href="/petty-cash">petty cash fund</ML>. You can optionally add a secondary
                source if the primary fund is insufficient.
              </WorkflowStep>
              <WorkflowStep n={2} title="Send the secure link">
                After saving, a unique one-time link is generated. Copy it from the card and
                share it verbally or through <ML href="/chat">Messages</ML>. The link is
                passcode-protected and expires on the date you set.
              </WorkflowStep>
              <WorkflowStep n={3} title="Requestor unlocks and fills the form">
                The requestor opens the link in any browser (no login needed), enters their
                system passcode to verify their identity, then fills in the description, amount
                requested, and optionally uploads a supporting document (photo or PDF).
              </WorkflowStep>
              <WorkflowStep n={4} title="Requestor confirms with passcode">
                Before final submission the requestor reviews their entries and re-enters their
                passcode to confirm. This creates a tamper-evident record of who submitted the
                request.
              </WorkflowStep>
              <WorkflowStep n={5} title="Accounting reviews — approve or reject">
                The submitted request appears in the <strong>Submitted — needs review</strong>{" "}
                section. Approve with an optional note, or reject with a reason. Either way, a{" "}
                <ML href="/chat">chat notification</ML> is automatically sent to the requestor.
              </WorkflowStep>
              <WorkflowStep n={6} title="Budget release">
                Once the fund is physically ready (check cleared or cash counted), click{" "}
                <strong>Release Budget</strong>. The system automatically:
                <ul className="mt-2 ml-4 list-disc space-y-1 text-stone-500">
                  <li>Creates an expense record in <ML href="/expenses">General Expenses</ML> (visible in <ML href="/finance">P&amp;L Reports</ML>)</li>
                  <li>If the source is petty cash, records a disbursement in <ML href="/petty-cash">Petty Cash</ML></li>
                  <li>Sends a <ML href="/chat">chat notification</ML> to the requestor</li>
                </ul>
              </WorkflowStep>
            </ol>
          </article>
        )}

        {/* General Expenses */}
        {myKeys.has("expenses") && (
          <article id="guide-expenses" className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-stone-800">
                <ML href="/expenses">General Expenses</ML> — How It Works
              </h3>
              <Link href="/expenses" className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                Open module →
              </Link>
            </div>
            <ol className="space-y-4 text-sm text-stone-700">
              <WorkflowStep n={1} title="Set up categories and vendors first">
                Open <ML href="/expenses">General Expenses</ML> and expand the{" "}
                <strong>Categories</strong> and <strong>Vendors / Payees</strong> sections to
                add the types of expenses and the suppliers or payees your team uses regularly.
                These populate the dropdowns when recording.
              </WorkflowStep>
              <WorkflowStep n={2} title="Record an expense">
                Click <strong>Record expense</strong>. Fill in the date, category, vendor,
                amount, source (bank account or <ML href="/petty-cash">petty cash fund</ML>),
                and optional OR number and remarks. Amounts of ₱10,000 and above require
                approval before they appear in <ML href="/finance">P&amp;L Reports</ML>.
              </WorkflowStep>
              <WorkflowStep n={3} title="CSV bulk import">
                To import historical records, download the CSV template from the import panel,
                fill it in (Date, Category, Vendor/Payee, Amount, Source, Bank Account,
                Remarks), and upload it. The system previews rows before committing.
              </WorkflowStep>
              <WorkflowStep n={4} title="View in P&L">
                All approved expenses appear automatically in{" "}
                <ML href="/finance">P&amp;L / Reports</ML> under the relevant period.
              </WorkflowStep>
            </ol>
          </article>
        )}

        {/* Petty Cash */}
        {myKeys.has("petty_cash") && (
          <article id="guide-petty-cash" className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-stone-800">
                <ML href="/petty-cash">Petty Cash</ML> — How It Works
              </h3>
              <Link href="/petty-cash" className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                Open module →
              </Link>
            </div>
            <ol className="space-y-4 text-sm text-stone-700">
              <WorkflowStep n={1} title="Create a petty cash fund">
                In <ML href="/petty-cash">Petty Cash</ML>, create a fund (e.g. "Office Petty
                Cash") with an initial balance of zero. Funds are separate pools — you might
                have one per department or location.
              </WorkflowStep>
              <WorkflowStep n={2} title="Load cash from bank">
                Use <strong>Load from bank</strong> to transfer a fixed amount from a{" "}
                <ML href="/banking">bank account</ML> into the petty cash fund. This records
                a debit on the bank account and credits the fund balance.
              </WorkflowStep>
              <WorkflowStep n={3} title="Disburse with a PCV voucher">
                Click <strong>New disbursement</strong> to record a cash-out. Fill in the
                payee, purpose, and amount. A Petty Cash Voucher (PCV) number is assigned
                automatically and the fund balance decreases.
              </WorkflowStep>
              <WorkflowStep n={4} title="Fund appears as a budget source">
                When creating a <ML href="/pmt-requests">Payment Request</ML> or recording an{" "}
                <ML href="/expenses">expense</ML>, petty cash funds appear as a budget source
                option alongside bank accounts. The current balance is shown at selection time.
              </WorkflowStep>
            </ol>
          </article>
        )}
      </section>

      {/* ── Full Module Reference ───────────────────────────────── */}
      <section id="reference">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-stone-500">
          Module Reference
        </h2>
        <div className="space-y-6">
          {GROUPS.map((group) => {
            const mods = group.keys
              .filter((k, i, arr) => arr.indexOf(k) === i)
              .map((k) => MODULES[k as keyof typeof MODULES])
              .filter(Boolean) as ModuleDef[];
            if (mods.length === 0) return null;
            return (
              <div key={group.label}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400">
                  {group.label}
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
                        <th className="px-4 py-2 text-left">Module</th>
                        <th className="px-4 py-2 text-left">Description</th>
                        <th className="px-4 py-2 text-left">Guide</th>
                        <th className="px-4 py-2 text-left">Access</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {mods.map((mod) => {
                        const canAccess = myKeys.has(mod.key);
                        const hasGuide = ["pmt_requests", "expenses", "petty_cash"].includes(mod.key);
                        const guideId = mod.key.replace(/_/g, "-");
                        return (
                          <tr key={mod.key} className={canAccess ? "" : "opacity-40"}>
                            <td className="whitespace-nowrap px-4 py-2.5 font-medium text-stone-800">
                              {canAccess ? (
                                <Link href={mod.path} className="text-emerald-700 underline-offset-2 hover:underline">
                                  {mod.label}
                                </Link>
                              ) : (
                                <span>{mod.label}</span>
                              )}
                              {WHATS_NEW.some((n) => n.key === mod.key && n.kind === "new") && (
                                <span className="ml-1.5 inline-flex rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                  NEW
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-stone-600">{mod.blurb}</td>
                            <td className="px-4 py-2.5">
                              {hasGuide && canAccess ? (
                                <Link
                                  href={`#guide-${guideId}`}
                                  className="text-xs text-emerald-600 underline-offset-2 hover:underline"
                                >
                                  Read guide ↑
                                </Link>
                              ) : (
                                <span className="text-xs text-stone-300">—</span>
                              )}
                            </td>
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

      <p className="mt-8 text-center text-xs text-stone-400">
        <Link href="/changelog" className="text-emerald-600 underline-offset-2 hover:underline">
          View full changelog
        </Link>
        {" · "}
        <Link href="/chat" className="text-emerald-600 underline-offset-2 hover:underline">
          Contact support via Messages
        </Link>
      </p>
    </>
  );
}

function WorkflowStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
        {n}
      </span>
      <div>
        <p className="font-semibold text-stone-800">{title}</p>
        <p className="mt-0.5 text-stone-500 leading-relaxed">{children}</p>
      </div>
    </li>
  );
}

function ModuleCard({ mod, badge }: { mod: ModuleDef; badge?: string }) {
  return (
    <Link
      href={mod.path}
      className="group block rounded-2xl border border-stone-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-stone-800 group-hover:text-emerald-700">{mod.label}</p>
        {badge === "new" && (
          <span className="shrink-0 inline-flex rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
            NEW
          </span>
        )}
        {badge === "fixed" && (
          <span className="shrink-0 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
            FIXED
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-stone-500">{mod.blurb}</p>
    </Link>
  );
}
