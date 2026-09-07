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
    label: "Bug Fixes",
    changes: [
      { kind: "fixed",    text: 'General Expenses — "Record expense" showed actor_role column error; recording now works correctly', link: "/expenses" },
      { kind: "fixed",    text: "Vercel build error caused by server-only module transitively imported by a client component", link: "/expenses" },
      { kind: "fixed",    text: "Payment Requests API route — params type updated for Next.js 15/16 compatibility", link: "/pmt-requests" },
    ],
  },
  {
    version: "v1.30",
    date: "Sep 7, 2026",
    label: "Payment Requests + Help & Docs",
    changes: [
      { kind: "new",      text: "Payment Requests — accounting creates a secure, passcode-protected link for requestors; tracks submission, approval/rejection, and budget release with automatic chat notifications", link: "/pmt-requests" },
      { kind: "new",      text: "Help & Documentation page — module guides, workflow references, and quick links for all staff", link: "/docs" },
      { kind: "new",      text: "Changelog page (this page)", link: "/changelog" },
      { kind: "improved", text: "Consultant role now has explicit write access on Payment Requests (can create and approve forms)" },
    ],
  },
  {
    version: "v1.29",
    date: "Sep 7, 2026",
    label: "General Expenses & Petty Cash",
    changes: [
      { kind: "new",      text: "General Expenses module — record expenses against bank account or petty cash, with category/vendor management and CSV bulk import", link: "/expenses" },
      { kind: "new",      text: "Petty Cash module — manage funds: load from bank, disburse with PCV vouchers, view running balances", link: "/petty-cash" },
      { kind: "improved", text: "P&L / Reports now reflects general expenses and petty cash disbursements in real time", link: "/finance" },
      { kind: "fixed",    text: "Petty Cash — staff options query used wrong column name (role vs role_key)", link: "/petty-cash" },
    ],
  },
  {
    version: "v1.28",
    date: "Aug 31–Sep 2, 2026",
    label: "P&L, Post-dated Checks & Discrepancy",
    changes: [
      { kind: "new",      text: "P&L report — period presets, year-over-year comparison, KPI tiles, margin, and expense breakdown", link: "/finance" },
      { kind: "new",      text: "Post-dated checks — custody panel, stale-transmittal alarm, and check notifications", link: "/banking" },
      { kind: "new",      text: "Collection discrepancy report for hotel and rental monitoring", link: "/collections" },
      { kind: "new",      text: "Collections — sort by collector, cashier audit log, checkout shortfall tracking", link: "/collections" },
      { kind: "new",      text: "Transmittal — check collection support and bank transfer proof upload", link: "/transmittals" },
      { kind: "new",      text: "Deposit bank correction — accounting/admin can fix wrong-bank deposits", link: "/banking" },
      { kind: "improved", text: "Accounting role granted inventory write access for price and data corrections", link: "/inventory" },
    ],
  },
  {
    version: "v1.27",
    date: "Aug 27–30, 2026",
    label: "Guard Module, Chat & Security",
    changes: [
      { kind: "new",      text: "Guard module — entrance log, shift management, referral verification, NDA gate, agency letter", link: "/guard" },
      { kind: "new",      text: "Staff Chat (real-time) — person-to-person messaging with duck quack notification sound", link: "/chat" },
      { kind: "new",      text: "Security hardening — forced sign-out, idle timeout, password strength enforcement" },
      { kind: "new",      text: "AirBnB guest portal — order history and request history", link: "/rentals" },
      { kind: "new",      text: "AirBnB staff panel — manage orders and requests from the rentals dashboard", link: "/rentals" },
      { kind: "new",      text: "BIR Subsidiary Sales Journal CSV export", link: "/finance" },
      { kind: "new",      text: "Bluetooth thermal print module (GOOJPRT PT-210)" },
      { kind: "new",      text: "Referral driver registry", link: "/guard" },
      { kind: "improved", text: "Hotel cashier bag counting — session-based denomination counting with 25-min alarm", link: "/hotel" },
      { kind: "improved", text: "Receipt — check-in/out times, actual hours, extensions, and transfer history", link: "/hotel" },
      { kind: "fixed",    text: "Chat permissions — all role pairs shown; management can always chat any role", link: "/chat" },
      { kind: "fixed",    text: "Guard NDA acknowledge crash; guard accounts page returning empty list", link: "/guard" },
    ],
  },
  {
    version: "v1.26",
    date: "Aug 20–26, 2026",
    label: "Hotel Operations Depth",
    changes: [
      { kind: "new",      text: "Room transfers — auto-compute upgrade shortfall; collect upgrade fee at transfer", link: "/hotel" },
      { kind: "new",      text: "Extra person charges — separate line items, add during stay, visible on folio", link: "/hotel" },
      { kind: "new",      text: "Room maintenance tracking with status board", link: "/hotel" },
      { kind: "new",      text: "Demo mode — ghost rooms, filtered boards, role hierarchy, end-demo cleanup", link: "/hotel" },
      { kind: "new",      text: "Day/Night shift type on hotel cashier sessions", link: "/hotel/shifts" },
      { kind: "improved", text: "Shift report — extension hours, discrepancy gate, monitoring corrections", link: "/hotel/shifts" },
      { kind: "improved", text: "Void shift preserves collections and active check-ins", link: "/hotel/shifts" },
      { kind: "fixed",    text: "Hotel room transfers ambiguous FK embed crashing discrepancy page" },
    ],
  },
  {
    version: "v1.25",
    date: "Aug 18–19, 2026",
    label: "Push Notifications & Hotel Cashier Sessions",
    changes: [
      { kind: "new",      text: "VAPID web push notifications for hotel and housekeeping alarms", link: "/hotel" },
      { kind: "new",      text: "Hotel cashier session gate — check-in, checkout, and payment gated on an active session", link: "/hotel" },
      { kind: "new",      text: "Hotel Shifts page — open, close, void cashier sessions; supervisor override panel", link: "/hotel/shifts" },
      { kind: "new",      text: "AR/OR register — editable AR at check-in, short-stay prompt", link: "/hotel" },
      { kind: "new",      text: "Hotel AR cancellations — cancel and reverse AR entries with audit trail", link: "/hotel" },
      { kind: "new",      text: "Housekeeping SLA alarm with snooze on the attendant board", link: "/housekeeping" },
      { kind: "new",      text: "System health dashboard at /admin/health", link: "/admin" },
      { kind: "new",      text: "Global timezone setting via app settings", link: "/admin" },
      { kind: "improved", text: "PWD/SC discounts — recompute-first flow, ID photo with bilingual consent, 48-hour auto-deletion", link: "/hotel" },
      { kind: "fixed",    text: "Server-rendered timestamps showing UTC instead of Philippine time" },
      { kind: "fixed",    text: "Inactive checkbox requiring manual Apply click" },
    ],
  },
  {
    version: "v1.24",
    date: "Aug 13–16, 2026",
    label: "Collection Form & Settings",
    changes: [
      { kind: "new",      text: "Collection form redesign — guided flow, batch charges, postdated check support", link: "/collections" },
      { kind: "new",      text: "Check clearing — PR to OR/SI with errand handoff notification", link: "/collections" },
      { kind: "new",      text: "Hotel shift handover and shift transmittal workflow", link: "/hotel/shifts" },
      { kind: "new",      text: "Unit rate cards and billing ledger with bank assignment", link: "/rentals" },
      { kind: "new",      text: "DB-driven collection item type catalog (accounting-managed)", link: "/admin" },
      { kind: "new",      text: "Bank deposit configuration and role group permission matrix", link: "/admin" },
      { kind: "new",      text: "Settings nav entry for accounting, admin, and managing officer", link: "/admin" },
      { kind: "improved", text: "Collection charge types filtered by bank configuration", link: "/collections" },
      { kind: "fixed",    text: "revalidateTag calls updated for Next.js 16 signature" },
    ],
  },
  {
    version: "v1.23",
    date: "Aug 10–12, 2026",
    label: "Collection Edits & Hotel Rates",
    changes: [
      { kind: "new",      text: "Justified collection edits — admin/accounting/consultant can make audited edits with reason logging", link: "/collections" },
      { kind: "new",      text: "Transmittal revert — allow revert of deposited transmittals; voids linked bank transaction", link: "/transmittals" },
      { kind: "new",      text: "Maker-checker approval workflow for collection edits and transmittal reverts", link: "/collections" },
      { kind: "new",      text: "Hotel full rate/promo CRUD — consultant access for rate management", link: "/hotel" },
      { kind: "new",      text: "Gift card system — schema, issuance, and redemption", link: "/hotel" },
      { kind: "new",      text: "Utility billing, reminder letters, and in-app notifications", link: "/rentals" },
      { kind: "new",      text: "Transmittal build — collection checkboxes, source/mode, parking series", link: "/transmittals" },
      { kind: "improved", text: "Show all un-transmitted collections across dates when building transmittal", link: "/transmittals" },
      { kind: "fixed",    text: "Transmittal total synced after linked collection is deleted", link: "/transmittals" },
    ],
  },
  {
    version: "v1.22",
    date: "Aug 5–6, 2026",
    label: "Accounting, Compliance & Housekeeping",
    changes: [
      { kind: "new",      text: "Accountable Forms registry — serialized OR/AR/checks, custodian, status, and reconciliation", link: "/forms" },
      { kind: "new",      text: "Commissions & Payables module — allowances, referral fees, broker commissions, incentives", link: "/payables" },
      { kind: "new",      text: "Bilingual (English/Filipino) support across attendance kiosk, housekeeping board, and repair portal" },
      { kind: "new",      text: "Housekeeping shift-change discipline — SLA timers, task endorsement, escalation", link: "/housekeeping" },
      { kind: "new",      text: "Email verification — invite and password-reset emails; verified badge on staff profiles", link: "/users" },
      { kind: "new",      text: "Attendance kiosk — on-demand camera, progress bars, fixed-salary (no-DTR) flag" },
      { kind: "new",      text: "Bulk DTR upload for payroll; DTR adjustment trail with owner approval", link: "/hr" },
      { kind: "new",      text: "Bulk select and delete across Collections, Disputes, Incidents, Inventory, Buyers, Requisitions" },
      { kind: "improved", text: "Hotel and AirBnB checkout-request alarm with sound and blinking card" },
    ],
  },
  {
    version: "v1.21",
    date: "Aug 4, 2026",
    label: "Finance, Polish & Access Control",
    changes: [
      { kind: "new",      text: "P&L / Reports module — sales report, expense summary, monthly profit view with charts", link: "/finance" },
      { kind: "new",      text: "Bank & Reconciliation module — bank accounts, deposits, check tracking", link: "/banking" },
      { kind: "new",      text: "Requisitions & Purchasing module — request, approve, and receive materials", link: "/requisitions" },
      { kind: "new",      text: "Act-as-role switcher — admin/consultant can preview the app as any other role" },
      { kind: "new",      text: "Consultant super-admin — full impersonation for testing and support" },
      { kind: "new",      text: "Adjustable table columns — show/hide and drag-to-reorder on Users, Employees, Inventory, Buyers, Requisitions" },
      { kind: "new",      text: "Google Sheets / CSV export on Finance, Transmittals, and Banking ledger", link: "/finance" },
      { kind: "new",      text: "Forgot-password reset flow and self-service email/password change" },
      { kind: "new",      text: "Dashboard per-module demo activity, employee photo, and launch pad per role" },
      { kind: "new",      text: "Brand logo, warm palette rollout, and login/portal polish" },
      { kind: "improved", text: "CSV import for config tables (staff, buyers, tenants, requisitions) with template download" },
      { kind: "improved", text: "Instant search/filter on Users, Employees, Buyers, and Tenants pages" },
    ],
  },
  {
    version: "v1.20",
    date: "Aug 3, 2026",
    label: "Core Operations",
    changes: [
      { kind: "new",      text: "Collections & daily cash transmittal workflow — cashier handover to accounting", link: "/collections" },
      { kind: "new",      text: "Cashiering module — denomination counting, online proof of collection, discounts", link: "/collections" },
      { kind: "new",      text: "Rentals & AirBnB module — occupancy tracking, utility meter readings, renter details", link: "/rentals" },
      { kind: "new",      text: "Hotel Phase B — day-end reporting, POS receipt printing, tax configuration, room orders", link: "/hotel" },
      { kind: "new",      text: "Housekeeping module — room cleaning board, task assignment, supply tracking, turnover workflow", link: "/housekeeping" },
      { kind: "new",      text: "Condo dues module — per-sqm association dues billing", link: "/condo" },
      { kind: "new",      text: "Renter portal — tenants view bills and payment history via unit + PIN" },
      { kind: "new",      text: "AirBnB guest QR portal — scan QR to access booking details" },
      { kind: "new",      text: "Inventory dispensing log — track items issued from stock with quantity and recipient", link: "/inventory" },
      { kind: "new",      text: "AR receipt series — configurable receipt number sequences", link: "/forms" },
      { kind: "new",      text: "Granular DB-driven access control — role group permission matrix, preview-any-role" },
    ],
  },
  {
    version: "v1.00",
    date: "Aug 2, 2026",
    label: "MVP Launch",
    changes: [
      { kind: "new",      text: "Inventory module — property/unit registry with custom fields and CSV import", link: "/inventory" },
      { kind: "new",      text: "Buyers module — buyer accounts, SOA computation, and payment history", link: "/buyers" },
      { kind: "new",      text: "Documents module — per-buyer document tracker and download", link: "/documents" },
      { kind: "new",      text: "Disputes module — case log and reference library", link: "/disputes" },
      { kind: "new",      text: "Repair requests — tenant/guest repair tickets with triage and photo upload", link: "/repairs" },
      { kind: "new",      text: "Owner Dashboard — simplified weekly financial overview", link: "/owner" },
      { kind: "new",      text: "HR module — DTR, payroll, employee photos, leave management, and 201 personnel file", link: "/hr" },
      { kind: "new",      text: "PH payroll engine — daily rate, late/undertime/overtime, night differential", link: "/hr" },
      { kind: "new",      text: "Shift scheduling — assign staff shifts per day with coverage-gap check", link: "/schedule" },
      { kind: "new",      text: "Public attendance kiosk — clock in/out with photo capture, QR badge login", link: "/schedule" },
      { kind: "new",      text: "Employee portal — personal attendance, payslip, and leave requests", link: "/me" },
      { kind: "new",      text: "Cash advance & liquidation module", link: "/advances" },
      { kind: "new",      text: "Hotel Ops module (Phase A) — room board, guest stays, folios, and receipts", link: "/hotel" },
      { kind: "new",      text: "Incident Reports module — security, safety, and damage reports with photos", link: "/incidents" },
      { kind: "new",      text: "Staff user management — invite emails, role assignment, verified badge", link: "/users" },
      { kind: "new",      text: "Role-based access control — per-module read/write permissions for every staff role" },
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
            <div className="flex flex-wrap items-baseline gap-3 border-b border-stone-100 pb-3 mb-4">
              <span className="font-mono text-sm font-bold text-stone-800">{release.version}</span>
              <span className="text-xs text-stone-400">{release.date}</span>
              {release.label && (
                <span className="text-xs font-semibold text-stone-600">{release.label}</span>
              )}
            </div>

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
        Sun Miles PMS · Initial build Aug 2, 2026 ·{" "}
        <Link href="/docs" className="text-emerald-600 hover:underline">
          See module guides →
        </Link>
      </p>
    </>
  );
}
