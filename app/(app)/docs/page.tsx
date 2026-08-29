import { requireModule } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Documentation" };

const VERSION = "v1.23";
const BUILD = 23;

const MODULES = [
  { name: "Hotel Operations", path: "/hotel", roles: "Hotel cashier, monitoring, room attendant, management", desc: "Room board with live timers, check-in / check-out, folio, orders, extensions, cashier shifts, AR register, discrepancy tracking, and day-end report." },
  { name: "Housekeeping", path: "/housekeeping", roles: "Room attendant, management", desc: "Task board driven by checkout events, room inspection form, supplies log, and turnover tracking." },
  { name: "Rentals & Airbnb", path: "/rentals", roles: "Hotel/rental monitoring, accounting, management", desc: "Long-term rental and Airbnb unit management, billing, utility charges, guest portal, and cleaning photo uploads." },
  { name: "Collections", path: "/collections", roles: "Hotel/rental monitoring, accounting, management", desc: "Daily cash summaries and transmittals with chain-of-custody tracking and bank deposit reconciliation." },
  { name: "Buyers", path: "/buyers", roles: "Accounting, management", desc: "Buyer accounts, SOA computation, payment history, and public buyer portal." },
  { name: "Condo Dues", path: "/condo", roles: "Accounting, management", desc: "Per-sqm monthly dues billing for condo units." },
  { name: "Inventory", path: "/inventory", roles: "Management, hotel ops, accounting", desc: "Property and room registry with custom fields, CSV import, and dispensing log." },
  { name: "Documents", path: "/documents", roles: "Admin, accounting, management", desc: "Per-buyer document checklist and file tracker." },
  { name: "Disputes", path: "/disputes", roles: "Accounting, management", desc: "Dispute log and reference case library." },
  { name: "Repair Requests", path: "/repair", roles: "All staff (submit), management (triage)", desc: "Public and staff repair submission, photo evidence, triage board, and status tracking." },
  { name: "Finance", path: "/finance", roles: "Accounting, management", desc: "Sales report, P&L, monthly summary, expense tracker, and BIR CSV export." },
  { name: "Banking", path: "/banking", roles: "Accounting, management", desc: "Multi-bank reconciliation, passbook tracking, and check release balancing." },
  { name: "HR / Payroll", path: "/hr", roles: "Warehouse timekeeper, accounting, management", desc: "DTR view, payroll computation (PH daily rate, OT, night diff, late/UT deductions)." },
  { name: "My Portal", path: "/me", roles: "All staff", desc: "Personal attendance (duty hours for guards), payslip (non-guard staff), and leave/OB/OT requests." },
  { name: "Employees", path: "/employees", roles: "Admin, management, accounting", desc: "Staff roster, photo uploads, 201 file, and leave approvals." },
  { name: "Cash Advance", path: "/advances", roles: "Most staff roles", desc: "Advance requests, approval workflow, and liquidation." },
  { name: "Shift Schedule", path: "/schedule", roles: "Admin, management, warehouse timekeeper", desc: "Daily shift assignment per staff member." },
  { name: "Guard Post", path: "/guard", roles: "Guard (agency), admin, management", desc: "Two operation types: Hotel Ops and Condo Ops. Agency guards — duty hours monitored only; no payslip, leave, OB, or OT. Extensible post system for future posts." },
  { name: "Users & Roles", path: "/users", roles: "Admin, management", desc: "Staff accounts, role assignment, email invite, password reset, and verified-email badge." },
  { name: "Settings", path: "/admin", roles: "Admin, management, accounting", desc: "Collection items, bank config, rate cards, tax settings, feature flags, and access control matrix." },
];

const ROLES = [
  { role: "Consultant", access: "Full super-admin access to everything", notes: "App programmer — bypasses all module checks" },
  { role: "Admin", access: "All staff modules", notes: "" },
  { role: "Managing Officer", access: "All operations modules", notes: "" },
  { role: "Operations Manager", access: "Hotel, housekeeping, HR, guard, advances", notes: "" },
  { role: "Accounting", access: "Collections, transmittals, buyers, finance, banking, payroll", notes: "" },
  { role: "Hotel/Rental Monitoring", access: "Hotel, housekeeping, rentals, collections, transmittals, advances", notes: "" },
  { role: "Hotel Cashier", access: "Hotel, inventory, advances", notes: "" },
  { role: "Room Attendant", access: "Housekeeping, repair (submit)", notes: "" },
  { role: "Guard", access: "Guard Post, My Portal (duty hours only)", notes: "Agency staff — no payslip, no leave/OB/OT requests" },
  { role: "Warehouse Timekeeper", access: "HR/Payroll, shift schedule", notes: "" },
  { role: "Errand Liaison", access: "Transmittals, advances", notes: "" },
  { role: "All other staff", access: "My Portal (attendance + payslip + requests)", notes: "Electrician, utility, admin/accounting/marketing/HR staff" },
  { role: "Owner", access: "Owner dashboard, employees (read), guard post (read)", notes: "External — no day-to-day operations access" },
];

const CHANGELOG = [
  {
    version: "v1.23",
    label: "Guard Portal — Agency Rules & Operation Types",
    items: [
      "Two guard types: Hotel Ops and Condo Ops (badge shown on accounts list)",
      "Guards see duty hours only in My Portal — payslip, leave, OB, and OT sections hidden",
      "Direct navigation to /me/payslip redirects guards back to /me",
      "Operation area selector in guard account editor; extensible post system for future posts",
      "Migration 0096: guard_operation column on profiles",
    ],
  },
  {
    version: "v1.22",
    label: "Security Hardening & BIR CSV Export",
    items: [
      "Session timeout (configurable via SESSION_TIMEOUT_MINUTES env var)",
      "Suspicious login alerts to admin email (ALERT_EMAIL_TO)",
      "Email verification gate — users must verify before accessing the app",
      "BIR-format CSV export on Finance page",
    ],
  },
  {
    version: "v1.21",
    label: "Cashier Shifts & Collection Audit",
    items: [
      "Hotel cashier sessions — check-in/out/payment gated on active session",
      "Collection entry edit with full audit trail (collection_edits table)",
      "Discrepancy resolution workflow for hotel shift reports",
    ],
  },
  {
    version: "v1.20",
    label: "Shift-Change Housekeeping & SLA",
    items: [
      "Occupancy board with live countdown timers per room type",
      "Endorsement workflow for shift handover",
      "SLA escalation on overdue tasks",
    ],
  },
];

export default async function DocsPage() {
  await requireModule("docs");

  return (
    <div className="mx-auto max-w-4xl space-y-10 pb-16">
      {/* Hero */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <PageHeader title="Sun Miles PMS" subtitle="Technical documentation & reference guide" />
            <p className="mt-2 text-sm text-stone-600">
              Property management system for Sun Miles Condominium — hotel operations, rentals, collections, HR, and more.
            </p>
          </div>
          <div className="text-right">
            <span className="rounded-full bg-amber-700 px-3 py-1 text-xs font-semibold text-white">{VERSION}</span>
            <p className="mt-1 text-[11px] text-stone-400">Build {BUILD}</p>
          </div>
        </div>
      </div>

      {/* Modules */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Modules</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULES.map((m) => (
            <div key={m.path} className="rounded-xl border border-stone-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-stone-800">{m.name}</p>
                <code className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-500">{m.path}</code>
              </div>
              <p className="mt-1 text-xs text-amber-700">{m.roles}</p>
              <p className="mt-1.5 text-xs text-stone-500">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Roles & Access</h2>
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r.role} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-stone-800 whitespace-nowrap">{r.role}</td>
                  <td className="px-4 py-2.5 text-stone-600">{r.access}</td>
                  <td className="px-4 py-2.5 text-stone-400">{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Setup */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Setup & Environment</h2>
        <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-stone-700 mb-1">Required environment variables</p>
            <div className="rounded-lg bg-stone-50 p-3 font-mono text-xs text-stone-600 space-y-0.5">
              {[
                "NEXT_PUBLIC_SUPABASE_URL",
                "NEXT_PUBLIC_SUPABASE_ANON_KEY",
                "SUPABASE_SERVICE_ROLE_KEY",
                "NEXTAUTH_SECRET",
                "SESSION_TIMEOUT_MINUTES",
                "ALERT_EMAIL_TO",
              ].map((v) => <p key={v}>{v}</p>)}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-stone-700 mb-1">Latest migration</p>
            <code className="rounded bg-stone-100 px-2 py-1 text-xs text-stone-600">0096_guard_operation_type.sql</code>
          </div>
          <div>
            <p className="text-sm font-medium text-stone-700 mb-1">Stack</p>
            <p className="text-sm text-stone-500">Next.js 16 · React 19 · Supabase (Postgres + RLS + Storage) · Vercel · Tailwind CSS</p>
          </div>
        </div>
      </section>

      {/* Changelog */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">Changelog</h2>
        <div className="space-y-4">
          {CHANGELOG.map((entry) => (
            <div key={entry.version} className="rounded-xl border border-stone-200 bg-white p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="rounded-full bg-stone-800 px-2.5 py-0.5 text-xs font-semibold text-white">{entry.version}</span>
                <p className="font-medium text-stone-800">{entry.label}</p>
              </div>
              <ul className="space-y-1">
                {entry.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-stone-600">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
