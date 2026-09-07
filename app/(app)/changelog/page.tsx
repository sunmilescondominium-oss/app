import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { Breadcrumb, PageHeader } from "@/components/ui";

export const metadata = { title: "Changelog" };

type EntryKind = "new" | "improved" | "fixed" | "removed";

interface ChangeEntry {
  kind: EntryKind;
  text: string;
  link?: string;
}

interface Release {
  version: string;
  date: string;
  label?: string;
  changes: ChangeEntry[];
}

const KIND_STYLE: Record<EntryKind, { bg: string; text: string; label: string }> = {
  new:      { bg: "bg-emerald-100", text: "text-emerald-700", label: "New" },
  improved: { bg: "bg-blue-100",    text: "text-blue-700",    label: "Improved" },
  fixed:    { bg: "bg-amber-100",   text: "text-amber-700",   label: "Fixed" },
  removed:  { bg: "bg-rose-100",    text: "text-rose-700",    label: "Removed" },
};

const RELEASES: Release[] = [
  {
    version: "v1.31",
    date: "Sep 7, 2026",
    changes: [
      { kind: "fixed",    text: 'General Expenses — recording an expense showed "actor_role column not found" error', link: "/expenses" },
      { kind: "fixed",    text: "Payment Requests — Vercel build error caused by server-only module imported by client component", link: "/pmt-requests" },
      { kind: "fixed",    text: "Payment Requests API route — params type updated for Next.js 15/16 compatibility", link: "/pmt-requests" },
    ],
  },
  {
    version: "v1.30",
    date: "Sep 2026",
    label: "Payment Requests",
    changes: [
      { kind: "new",      text: "Payment Requests module — accounting creates a secure, passcode-protected link for requestors; tracks submission, approval/rejection, and budget release with automatic chat notifications", link: "/pmt-requests" },
      { kind: "new",      text: "Help & Documentation page — module reference, quick links, and workflow guides for all staff", link: "/docs" },
      { kind: "new",      text: "This Changelog page", link: "/changelog" },
      { kind: "improved", text: "Consultant role now has write access on Payment Requests (can create and approve forms)" },
    ],
  },
  {
    version: "v1.29",
    date: "Aug 2026",
    label: "General Expenses & Petty Cash",
    changes: [
      { kind: "new",      text: "General Expenses module — record expenses against bank account or petty cash, with category/vendor management and CSV bulk import", link: "/expenses" },
      { kind: "new",      text: "Petty Cash module — manage petty cash funds: load from bank, disburse with PCV vouchers, view running balances", link: "/petty-cash" },
      { kind: "improved", text: "P&L / Reports now reflects general expenses and petty cash disbursements in real time", link: "/finance" },
    ],
  },
  {
    version: "v1.28",
    date: "Jul 2026",
    label: "AirBnB Operations",
    changes: [
      { kind: "new",      text: "AirBnB settings — rate plans, extra charges, tax configuration, and utility rates per unit", link: "/rentals/settings" },
      { kind: "new",      text: "AirBnB orders & requests — guest portal for placing service orders and maintenance requests during stay", link: "/rentals" },
      { kind: "new",      text: "Rental tax settings + utility rate cards", link: "/rentals/settings" },
    ],
  },
  {
    version: "v1.27",
    date: "Jun 2026",
    label: "Hotel Cashier Sessions",
    changes: [
      { kind: "new",      text: "Hotel cashier session management — open/close cashier shifts; hotel check-in, checkout, and payment are gated on an active session", link: "/hotel" },
      { kind: "new",      text: "Hotel Shifts page — view and manage cashier sessions", link: "/hotel/shifts" },
      { kind: "new",      text: "Hotel AR cancellations — cancel and reverse AR entries with audit trail" },
    ],
  },
  {
    version: "v1.26",
    date: "Jun 2026",
    label: "Collection Audit & Edit",
    changes: [
      { kind: "new",      text: "Justified collection edits — admin/accounting/consultant can make audited edits to collection entries with reason logging", link: "/collections" },
      { kind: "new",      text: "Email verification on user accounts — invite and password-reset emails; verified badge on staff profiles", link: "/users" },
    ],
  },
  {
    version: "v1.25",
    date: "Jun 2026",
    label: "Housekeeping SLA & Shift-Change",
    changes: [
      { kind: "new",      text: "Per-room-type SLA timers — auto-escalate overdue housekeeping tasks based on configurable time limits", link: "/housekeeping" },
      { kind: "new",      text: "Shift-change endorsement — room attendants hand over pending tasks at shift cutoff", link: "/housekeeping" },
      { kind: "new",      text: "Occupancy board with live countdown timers for checkout and cleaning deadlines", link: "/hotel" },
    ],
  },
  {
    version: "v1.24",
    date: "May 2026",
    label: "Transmittal Chain of Custody",
    changes: [
      { kind: "new",      text: "Full transmittal chain of custody — every handoff step recorded with timestamp and signature", link: "/transmittals" },
      { kind: "new",      text: "Multi-bank reconciliation and check release balancing", link: "/banking" },
      { kind: "new",      text: "Inventory dispensing log — track items issued from stock with quantity and recipient", link: "/inventory" },
    ],
  },
  {
    version: "v1.23",
    date: "May 2026",
    label: "Condo Dues, Renter & Guest Portals",
    changes: [
      { kind: "new",      text: "Condo dues module — per-sqm association dues billing", link: "/condo" },
      { kind: "new",      text: "Renter public portal — tenants view bills and payment history via unit + PIN", link: "/rentals" },
      { kind: "new",      text: "AirBnB guest QR portal — guests scan QR to access their booking details", link: "/rentals" },
      { kind: "new",      text: "AR receipt series — configurable receipt number sequences", link: "/forms" },
    ],
  },
  {
    version: "v1.22",
    date: "Apr 2026",
    label: "HR, Payroll & Scheduling",
    changes: [
      { kind: "new",      text: "HR module — DTR, payroll, employee photos, leave management, and 201 personnel file", link: "/hr" },
      { kind: "new",      text: "PH payroll engine — daily rate, late/undertime/overtime, night differential", link: "/hr" },
      { kind: "new",      text: "Shift scheduling — assign staff shifts per day; public kiosk for clock-in/out with photo capture", link: "/schedule" },
      { kind: "new",      text: "QR login for kiosk — employees scan their QR badge to clock in", link: "/schedule" },
      { kind: "new",      text: "Cash advance & liquidation module", link: "/advances" },
    ],
  },
  {
    version: "v1.21",
    date: "Mar–Apr 2026",
    label: "Hotel Phase B & Housekeeping",
    changes: [
      { kind: "new",      text: "Hotel day-end reporting, POS receipt printing, and tax configuration", link: "/hotel" },
      { kind: "new",      text: "Hotel room orders and add-on charges from the front desk", link: "/hotel" },
      { kind: "new",      text: "Housekeeping module — room cleaning board, task assignment, supply tracking, and turnover workflow", link: "/housekeeping" },
      { kind: "new",      text: "Transmittal reconciliation and passbook tracking", link: "/transmittals" },
    ],
  },
  {
    version: "v1.20",
    date: "Mar 2026",
    label: "Hotel Operations & Rentals",
    changes: [
      { kind: "new",      text: "Hotel Ops module — room board, guest stays, folios, and receipts", link: "/hotel" },
      { kind: "new",      text: "Hotel rate plans engine with seasonal pricing and configurable taxes", link: "/hotel" },
      { kind: "new",      text: "Rentals & AirBnB module — occupancy tracking, utility meter readings, and renter details", link: "/rentals" },
      { kind: "new",      text: "Cashiering module — denomination counting, proof of collection, discounts", link: "/collections" },
    ],
  },
  {
    version: "v1.10",
    date: "Feb 2026",
    label: "Finance, Banking & Access Control",
    changes: [
      { kind: "new",      text: "P&L / Reports module — sales report, expense summary, and monthly profit view", link: "/finance" },
      { kind: "new",      text: "Bank & Reconciliation module — bank accounts, deposits, check tracking", link: "/banking" },
      { kind: "new",      text: "Accountable forms module — serialized OR/AR/check books with custodian tracking", link: "/forms" },
      { kind: "new",      text: "Commissions & Payables module", link: "/payables" },
      { kind: "new",      text: "Act-as-role switcher — admin/consultant can preview the app as any other role" },
    ],
  },
  {
    version: "v1.00",
    date: "Jan 2026",
    label: "MVP Launch",
    changes: [
      { kind: "new",      text: "Inventory module — property/unit registry with custom fields and CSV import", link: "/inventory" },
      { kind: "new",      text: "Collections & transmittal workflow — daily cash collection and bank deposit chain", link: "/collections" },
      { kind: "new",      text: "Buyers module — buyer accounts, SOA computation, and payment history", link: "/buyers" },
      { kind: "new",      text: "Documents module — per-buyer document tracker", link: "/documents" },
      { kind: "new",      text: "Disputes module — case log and reference library", link: "/disputes" },
      { kind: "new",      text: "Repair requests module — tenant/guest repair tickets with triage and photo upload", link: "/repairs" },
      { kind: "new",      text: "Owner Dashboard — simplified weekly financial overview", link: "/owner" },
      { kind: "new",      text: "Role-based access control — granular module read/write permissions per staff role" },
      { kind: "new",      text: "Staff user management with invite and password-reset emails", link: "/users" },
      { kind: "new",      text: "Internal messaging — staff chat with system notifications", link: "/chat" },
    ],
  },
];

export default async function ChangelogPage() {
  await requireModule("changelog");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Help & Docs", href: "/docs" },
          { label: "Changelog" },
        ]}
      />
      <PageHeader
        title="Changelog"
        subtitle="New features, improvements, and fixes — newest first."
      />

      <div className="space-y-8">
        {RELEASES.map((release) => (
          <div key={release.version} className="rounded-2xl border border-stone-200 bg-white p-5">
            {/* Header */}
            <div className="flex flex-wrap items-baseline gap-3 border-b border-stone-100 pb-3 mb-4">
              <span className="font-mono text-sm font-bold text-stone-800">{release.version}</span>
              <span className="text-xs text-stone-400">{release.date}</span>
              {release.label && (
                <span className="text-xs font-semibold text-stone-600">{release.label}</span>
              )}
            </div>

            {/* Changes */}
            <ul className="space-y-2">
              {release.changes.map((c, i) => {
                const style = KIND_STYLE[c.kind];
                return (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <span
                      className={`mt-0.5 shrink-0 inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.bg} ${style.text}`}
                    >
                      {style.label}
                    </span>
                    <span className="text-stone-600">
                      {c.link ? (
                        <Link href={c.link} className="text-emerald-700 underline-offset-2 hover:underline">
                          {c.text}
                        </Link>
                      ) : (
                        c.text
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-stone-400">
        Sun Miles PMS · Built by{" "}
        <Link href="/docs" className="text-emerald-600 hover:underline">
          See module guides →
        </Link>
      </p>
    </>
  );
}
