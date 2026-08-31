import Link from "next/link";
import { requireAuth } from "@/lib/auth/dal";
import { APP_BRAND } from "@/lib/config";

export const metadata = { title: "Help" };

// Roles that can see everything
const SUPER = ["admin", "managing_officer", "consultant"];

// Returns true if the viewer should see a section tagged with `sectionRoles`
function visible(userRoles: string[], sectionRoles: string[]): boolean {
  if (sectionRoles.includes("*")) return true;
  if (userRoles.some((r) => SUPER.includes(r))) return true;
  return sectionRoles.some((r) => userRoles.includes(r));
}

// TOC items — only included when visible
type TocItem = { id: string; title: string; roles: string[] };

const ALL_SECTIONS: TocItem[] = [
  { id: "s-portal",    title: "My Portal & Kiosk — all staff",          roles: ["*"] },
  { id: "s-guard",     title: "Guard Post operations",                   roles: ["guard"] },
  { id: "s-cashier",   title: "Hotel cashier workflow",                  roles: ["hotel_cashier"] },
  { id: "s-monitor",   title: "Hotel & Rental monitoring",               roles: ["hotel_rental_monitoring"] },
  { id: "s-acctg",     title: "Collections, transmittals & finance",     roles: ["accounting", "errand_liaison"] },
  { id: "s-hk",        title: "Housekeeping task workflow",              roles: ["room_attendant"] },
  { id: "s-repairs",   title: "Repairs & maintenance",                   roles: ["electrician", "utility", "operations_manager"] },
  { id: "s-whse",      title: "Inventory & timekeeping",                 roles: ["warehouse_timekeeper"] },
  { id: "s-admin",     title: "Admin panel & system configuration",      roles: ["admin", "managing_officer", "consultant"] },
  { id: "s-nav",       title: "System navigation — all pages",           roles: ["admin", "managing_officer", "consultant"] },
];

export default async function HelpPage() {
  const user = await requireAuth();
  const userRoles = user.roleKeys as string[];
  const isSuper = userRoles.some((r) => SUPER.includes(r));

  const visibleToc = ALL_SECTIONS.filter((s) => visible(userRoles, s.roles));

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="text-sm font-medium text-amber-700 hover:underline">
          ← Dashboard
        </Link>
        <button
          id="print-btn"
          className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-900"
        >
          🖨 Print / Save as PDF
        </button>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
        document.getElementById('print-btn').addEventListener('click', function() { window.print(); });
      `}} />

      <div className="mx-auto max-w-3xl help-doc">

        {/* Header */}
        <div className="mb-8 border-b-2 border-amber-600 pb-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">Sun Miles PMS</span>
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Help</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Staff Help Guide</h1>
          <p className="mt-1 text-sm text-stone-500">
            Role-scoped help — you see only the sections that apply to your role
            {isSuper ? " (you have super access and can see all sections)" : ""}.
          </p>
        </div>

        {/* TOC */}
        {visibleToc.length > 0 && (
          <div className="mb-8 rounded-xl border border-stone-200 bg-stone-50 px-5 py-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-stone-400">Contents</p>
            <ol className="grid gap-1 pl-4 text-sm">
              {visibleToc.map((t, i) => (
                <li key={t.id}><a href={`#${t.id}`} className="text-amber-700 hover:underline">{i + 1}. {t.title}</a></li>
              ))}
            </ol>
          </div>
        )}

        {/* ── My Portal & Kiosk (all staff) ── */}
        {visible(userRoles, ["*"]) && (
          <Section id="s-portal" title="My Portal & Kiosk — all staff" who="All staff">
            <p className="mb-3 text-sm text-stone-500">Every staff member has a personal portal at <Code>/me</Code> and can use the physical kiosk to clock in/out.</p>
            <Steps>
              <Step n={1} label="Clock in via kiosk">
                At the kiosk screen (<Code>/kiosk</Code>), enter your <strong>Employee No</strong> and <strong>PIN</strong>, then tap <strong>Clock In</strong>. A photo is taken automatically. Your shift starts.
              </Step>
              <Step n={2} label="Clock out via kiosk">
                Same steps — enter Employee No + PIN, then tap <strong>Clock Out</strong>. Your duty hours for the day are recorded.
              </Step>
              <Step n={3} label="Submit leave, OB, or OT request">
                <>
                  Go to <Code>/me</Code> → <strong>Requests</strong> tab → choose request type:
                  <ul className="mt-1.5 list-disc pl-4 text-xs">
                    <li><strong>Leave</strong> — select dates and reason; supervisor approves</li>
                    <li><strong>OB</strong> (Official Business) — enter date, destination, purpose</li>
                    <li><strong>OT</strong> (Overtime) — enter date and hours rendered</li>
                  </ul>
                </>
              </Step>
              <Step n={4} label="View your payslip">
                Go to <Code>/me</Code> → click <strong>View payslip →</strong>. Shows your current period&apos;s DTR summary and computed pay.
              </Step>
            </Steps>
            <Callout type="tip">
              Guards use the Guard Post shift system instead of the kiosk — not both. Duty hours are recorded through shift start/end on <Code>/guard</Code>.
            </Callout>
          </Section>
        )}

        {/* ── Guard Post ── */}
        {visible(userRoles, ["guard"]) && (
          <Section id="s-guard" title="Guard Post operations" who="Guard">
            <Callout type="info">
              Full step-by-step guard instructions (NDA, shift start, entry logging, handover) are in the dedicated guard guide: <Link href="/guard/help" className="font-semibold text-amber-700 hover:underline">Guard Post Help →</Link>
            </Callout>
            <Steps>
              <Step n={1} label="First login — acknowledge the NDA">
                On your first login, navigate to <Code>/guard</Code>. Read the Non-Disclosure &amp; Conduct Agreement and click <strong>I Acknowledge</strong>. This is a one-time step.
              </Step>
              <Step n={2} label="Start your shift">
                Select your assigned <strong>Post</strong> and <strong>Shift type</strong> (Day / Night), then click <strong>Start Shift</strong>. The panel turns green.
              </Step>
              <Step n={3} label="Log every entry">
                For every person or vehicle entering: select <strong>Entry type</strong>, fill in vehicle details if applicable, and click <strong>Log Entry →</strong>. Record coupon/card numbers for guests with promos.
              </Step>
              <Step n={4} label="End shift with handover">
                Click <strong>End Shift</strong> → fill in incidents and pending items → click <strong>Submit handover and end shift</strong>. The next guard must read and acknowledge your notes before starting.
              </Step>
            </Steps>
          </Section>
        )}

        {/* ── Hotel Cashier ── */}
        {visible(userRoles, ["hotel_cashier"]) && (
          <Section id="s-cashier" title="Hotel cashier workflow" who="Hotel Cashier">
            <Callout type="warn">
              A cashier session must be open before you can check in guests, record payments, or check out. All hotel transactions are locked to your session.
            </Callout>
            <Steps>
              <Step n={1} label="Open your cashier session">
                Go to <Code>/hotel/shifts</Code> → click <strong>Open new session</strong> → enter your starting cash on hand → click <strong>Open</strong>. The hotel board is now active for you.
              </Step>
              <Step n={2} label="Check in a guest">
                On <Code>/hotel</Code>, find a vacant room → click its card → click <strong>Check In</strong> → fill in guest name, planned hours, and rate plan → confirm. The room timer starts.
              </Step>
              <Step n={3} label="Add orders or extras">
                On the room&apos;s folio page (<Code>/hotel/[stayId]</Code>), click <strong>Add order</strong> to attach food, extra hours, or other charges to the stay.
              </Step>
              <Step n={4} label="Process payment and check out">
                On the room folio → click <strong>Check Out</strong> → review the total → select <strong>Payment method</strong> (cash, card, GCash, etc.) → click <strong>Confirm checkout</strong>. A receipt is generated. The room goes to Housekeeping.
              </Step>
              <Step n={5} label="Close your cashier session">
                At end of shift → go to <Code>/hotel/shifts</Code> → click <strong>Close session</strong> → enter your cash count per denomination → submit. The system compares your count to expected cash and flags any discrepancy.
              </Step>
              <Step n={6} label="Day-end summary">
                <>
                  Go to <Code>/hotel/day</Code> to view today&apos;s full summary — total collections by payment method, room count, and taxes. Use this to prepare the day-end report.
                </>
              </Step>
            </Steps>
            <Callout type="tip">
              AR (accounts receivable) balances from corporate accounts are managed at <Code>/hotel/ar-register</Code>. Gift cards at <Code>/hotel/gift-cards</Code>.
            </Callout>
          </Section>
        )}

        {/* ── Hotel & Rental Monitoring ── */}
        {visible(userRoles, ["hotel_rental_monitoring"]) && (
          <Section id="s-monitor" title="Hotel & Rental monitoring" who="Hotel & Rental Monitoring">
            <Steps>
              <Step n={1} label="Enter hotel collections">
                Go to <Code>/collections</Code> → click <strong>New collection</strong> → select <strong>Hotel</strong> category → fill in amount, payment method, and OR number → save.
              </Step>
              <Step n={2} label="Enter rental or utility collections">
                Same as above but select <strong>Rental</strong>, <strong>Utility</strong>, or <strong>Parking</strong> as the category.
              </Step>
              <Step n={3} label="Monitor the hotel board">
                <Code>/hotel</Code> shows all rooms — occupied (with countdown timer), vacant, and for-housekeeping. You can view but not modify stays without the cashier session.
              </Step>
              <Step n={4} label="Monitor rental occupancy">
                <Code>/rentals</Code> shows all units — occupied, vacant, and checkout-requested. Click any unit to view dues, meter readings, and the current lease.
              </Step>
            </Steps>
          </Section>
        )}

        {/* ── Collections, Transmittals & Finance ── */}
        {visible(userRoles, ["accounting", "errand_liaison"]) && (
          <Section id="s-acctg" title="Collections, transmittals & finance" who="Accounting / Errand & Liaison">
            <Steps>
              <Step n={1} label="Enter a collection">
                Go to <Code>/collections</Code> → <strong>New collection</strong> → select category (hotel, rental, parking, utility…), fill amount, OR number, and payment method → save. The collection appears on the dashboard.
              </Step>
              <Step n={2} label="Create a transmittal">
                On <Code>/transmittals</Code> → click <strong>New transmittal</strong> → select the bank and deposit date → the system pulls eligible collections → review → click <strong>Submit for approval</strong>.
              </Step>
              <Step n={3} label="Confirm a bank deposit (Errand & Liaison)">
                After physically depositing, find the transmittal on <Code>/transmittals</Code> → click <strong>Confirm deposit</strong> → enter the bank validation number. Status changes to Deposited.
              </Step>
              <Step n={4} label="Approve a transmittal (Accounting / Management)">
                Open the transmittal → review → click <strong>Approve</strong>. The collections are locked and the transmittal is archived.
              </Step>
              <Step n={5} label="Bank reconciliation">
                Go to <Code>/banking</Code> → select a bank account → view the passbook balance vs. total deposited. Enter any adjustment or new balance update.
              </Step>
              <Step n={6} label="Log a payable or advance">
                Payables: <Code>/payables</Code> → <strong>New payable</strong>. Cash advances: <Code>/advances</Code> → <strong>New advance</strong>. Both track status (pending → paid / liquidated).
              </Step>
              <Step n={7} label="Finance reports">
                <Code>/finance</Code> shows the P&amp;L, monthly collections summary, and expense breakdown. Use the date filters to scope to any period.
              </Step>
            </Steps>
          </Section>
        )}

        {/* ── Housekeeping ── */}
        {visible(userRoles, ["room_attendant"]) && (
          <Section id="s-hk" title="Housekeeping task workflow" who="Room Attendant">
            <Callout type="info">
              Housekeeping tasks are created automatically when a hotel guest checks out. You do not create tasks manually — they appear on your board.
            </Callout>
            <Steps>
              <Step n={1} label="View your tasks">
                Go to <Code>/housekeeping</Code>. Each card shows the room number, task type (turnover / routine / deep-clean), and the SLA deadline.
              </Step>
              <Step n={2} label="Start a task">
                Click the task card → click <strong>Start cleaning</strong>. The timer begins. The room status on the hotel board changes to In Progress.
              </Step>
              <Step n={3} label="Complete the room check">
                While cleaning, use the <strong>Room check</strong> section to tick off the checklist items (linen, amenities, fixtures, etc.).
              </Step>
              <Step n={4} label="Mark as ready">
                Click <strong>Mark ready</strong> when the room is fully cleaned and inspected. The room status on the hotel board returns to Vacant — available for the next check-in.
              </Step>
              <Step n={5} label="Log supplies used">
                After completing, tap <strong>Supplies used</strong> → enter quantities. This deducts from the inventory automatically.
              </Step>
            </Steps>
          </Section>
        )}

        {/* ── Repairs & Maintenance ── */}
        {visible(userRoles, ["electrician", "utility", "operations_manager"]) && (
          <Section id="s-repairs" title="Repairs & maintenance" who="Electrician / Utility / Operations Manager">
            <Steps>
              <Step n={1} label="View assigned work orders">
                Go to <Code>/repairs</Code>. The board shows all open work orders — filter by status (Pending / In Progress / Done) or by your trade type.
              </Step>
              <Step n={2} label="Accept and start a work order">
                Click the work order → click <strong>Start work</strong>. Describe the initial assessment in the notes field. The requester is notified.
              </Step>
              <Step n={3} label="Update progress">
                On the work order detail, add progress notes and attach a photo if needed (<strong>Add photo</strong>). Change status to <strong>In Progress</strong>.
              </Step>
              <Step n={4} label="Mark as done">
                Once complete, click <strong>Mark done</strong> → add completion notes and a final photo. Status changes to Done and management is notified.
              </Step>
            </Steps>
            <Callout type="info">
              Operations Manager: you can also create and assign work orders from <Code>/repairs</Code> → <strong>New work order</strong>.
            </Callout>
          </Section>
        )}

        {/* ── Inventory & Timekeeping ── */}
        {visible(userRoles, ["warehouse_timekeeper"]) && (
          <Section id="s-whse" title="Inventory & timekeeping" who="Warehouse & Timekeeper">
            <Steps>
              <Step n={1} label="Dispense supplies">
                Go to <Code>/inventory</Code> → find the item → click <strong>Dispense</strong> → enter quantity and recipient → confirm. The stock count decreases automatically.
              </Step>
              <Step n={2} label="Add new stock">
                On <Code>/inventory</Code> → click <strong>Add item</strong> or <strong>Restock</strong> on an existing item → enter quantity received and source.
              </Step>
              <Step n={3} label="Review employee DTR">
                Go to <Code>/hr</Code> → select an employee → view their daily time record for the current or any past period. Missing clock-outs appear highlighted in amber.
              </Step>
              <Step n={4} label="Correct a DTR entry">
                On the DTR view → click the row with the error → click <strong>Edit</strong> → correct the time-in or time-out → save. An audit note is required.
              </Step>
            </Steps>
          </Section>
        )}

        {/* ── Admin & System Config (super only) ── */}
        {visible(userRoles, ["admin", "managing_officer", "consultant"]) && (
          <Section id="s-admin" title="Admin panel & system configuration" who="Admin / Managing Officer / Consultant">
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {[
                { path: "/admin/collection-items", title: "Collection Item Types",   desc: "Define what can be collected — parking, utility, rent, hotel room, etc." },
                { path: "/admin/bank-config",       title: "Bank Deposit Config",    desc: "Map collection categories to banks; set allowed items per deposit." },
                { path: "/admin/role-permissions",  title: "Role Permissions",       desc: "Granular module access per role group. DB-driven — no deploy needed." },
                { path: "/admin/rate-cards",        title: "Unit Rate Cards",        desc: "Monthly billing items per unit (rental, condo, airbnb, parking)." },
                { path: "/admin/settings",          title: "App Settings",           desc: "Timezone and location-specific global configuration." },
                { path: "/admin/flags",             title: "Feature Flags",          desc: "Enable/disable optional modules without a deployment." },
                { path: "/admin/health",            title: "System Health",          desc: "Connectivity, free-tier usage, error log. Copy diagnostics for your developer." },
              ].map((p) => (
                <Link key={p.path} href={p.path} className="rounded-lg border border-stone-200 bg-stone-50 p-3 hover:bg-amber-50 hover:border-amber-200 transition">
                  <p className="text-xs font-bold text-stone-800">{p.title}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-amber-700">{p.path}</p>
                  <p className="mt-1 text-xs text-stone-500">{p.desc}</p>
                </Link>
              ))}
            </div>
            <Steps>
              <Step n="!" label="Inviting a new user">
                Go to <Code>/users</Code> → <strong>Invite user</strong> → enter email and assign role(s) → send. They receive an email to set their own password.
              </Step>
              <Step n="!" label="Resetting a user's password">
                Go to <Code>/users</Code> → find the user → click <strong>Send password reset</strong>. They receive an email link valid for 24 hours.
              </Step>
              <Step n="!" label="Setting up a guard account">
                After inviting a guard: go to <Code>/guard/accounts</Code> → find the guard → click <strong>Edit</strong> → set Operation area, agency, position, and contract expiry.
              </Step>
            </Steps>
          </Section>
        )}

        {/* ── System Navigation (super only) ── */}
        {visible(userRoles, ["admin", "managing_officer", "consultant"]) && (
          <Section id="s-nav" title="System navigation — all pages and entry points" who="Admin / Managing Officer / Consultant">
            <p className="mb-3 text-sm text-stone-500">Every page is reachable by clicking — no URL typing required.</p>
            <Table heads={["Page / path", "How to reach it"]}>
              <tr className="bg-stone-50"><td colSpan={2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">Guard Post</td></tr>
              <tr><Td><Code>/guard</Code></Td><Td>Sidebar → Guard Post</Td></tr>
              <tr><Td><Code>/guard/help</Code></Td><Td>Guard Post → Help → (top-right)</Td></tr>
              <tr><Td><Code>/guard/accounts</Code></Td><Td>Guard Post → Guard accounts → (admin only)</Td></tr>
              <tr><Td><Code>/guard/referrals</Code></Td><Td>Guard Post → Referral drivers → (admin only)</Td></tr>
              <tr><Td><Code>/guard/letter/[id]</Code></Td><Td>Guard Accounts → Print letter button</Td></tr>
              <tr className="bg-stone-50"><td colSpan={2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">Admin</td></tr>
              <tr><Td><Code>/admin</Code></Td><Td>Sidebar → Admin</Td></tr>
              <tr><Td><Code>/admin/collection-items</Code></Td><Td>Admin → Collection Item Types card</Td></tr>
              <tr><Td><Code>/admin/bank-config</Code></Td><Td>Admin → Bank Deposit Config card</Td></tr>
              <tr><Td><Code>/admin/role-permissions</Code></Td><Td>Admin → Role Permissions card</Td></tr>
              <tr><Td><Code>/admin/rate-cards</Code></Td><Td>Admin → Unit Rate Cards card</Td></tr>
              <tr><Td><Code>/admin/settings</Code></Td><Td>Admin → App Settings card</Td></tr>
              <tr><Td><Code>/admin/flags</Code></Td><Td>Admin → Feature Flags card</Td></tr>
              <tr><Td><Code>/admin/health</Code></Td><Td>Admin → System Health card</Td></tr>
              <tr className="bg-stone-50"><td colSpan={2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">Hotel</td></tr>
              <tr><Td><Code>/hotel</Code></Td><Td>Sidebar → Hotel</Td></tr>
              <tr><Td><Code>/hotel/[stayId]</Code></Td><Td>Hotel → click any room card</Td></tr>
              <tr><Td><Code>/hotel/day</Code></Td><Td>Hotel → Day close → link</Td></tr>
              <tr><Td><Code>/hotel/shifts</Code></Td><Td>Hotel → Cashier shifts → link</Td></tr>
              <tr><Td><Code>/hotel/shifts/[id]/report</Code></Td><Td>Hotel Shifts → click any closed session</Td></tr>
              <tr><Td><Code>/hotel/ar-register</Code></Td><Td>Hotel → AR register → link</Td></tr>
              <tr><Td><Code>/hotel/gift-cards</Code></Td><Td>Hotel → Gift cards → link</Td></tr>
              <tr><Td><Code>/hotel/transfers</Code></Td><Td>Hotel → Transfers → link</Td></tr>
              <tr><Td><Code>/hotel/discrepancies</Code></Td><Td>Hotel → Discrepancies → link</Td></tr>
              <tr className="bg-stone-50"><td colSpan={2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">Rentals & Airbnb</td></tr>
              <tr><Td><Code>/rentals</Code></Td><Td>Sidebar → Rentals &amp; Airbnb</Td></tr>
              <tr><Td><Code>/rentals/[unitId]</Code></Td><Td>Rentals → click any unit card</Td></tr>
              <tr><Td><Code>/rentals/[unitId]/bill</Code></Td><Td>Unit detail → Monthly bill → button</Td></tr>
              <tr><Td><Code>/rentals/[unitId]/letter</Code></Td><Td>Unit detail → Reminder letter button</Td></tr>
              <tr><Td><Code>/rentals/utilities</Code></Td><Td>Rentals → Utilities button</Td></tr>
              <tr><Td><Code>/rentals/tenants</Code></Td><Td>Rentals → Tenants button</Td></tr>
              <tr><Td><Code>/rentals/settings</Code></Td><Td>Rentals → Settings button</Td></tr>
              <tr className="bg-stone-50"><td colSpan={2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">HR & Employees</td></tr>
              <tr><Td><Code>/hr</Code></Td><Td>Sidebar → HR</Td></tr>
              <tr><Td><Code>/hr/[userId]</Code></Td><Td>HR → click any employee row</Td></tr>
              <tr><Td><Code>/hr/performance</Code></Td><Td>HR → Performance → button</Td></tr>
              <tr><Td><Code>/hr/reports</Code></Td><Td>HR → Reports → button</Td></tr>
              <tr><Td><Code>/employees</Code></Td><Td>Sidebar → Employees</Td></tr>
              <tr><Td><Code>/employees/[id]</Code></Td><Td>Employees → click any employee row</Td></tr>
              <tr><Td><Code>/me</Code></Td><Td>Sidebar → My Portal</Td></tr>
              <tr><Td><Code>/me/payslip</Code></Td><Td>My Portal → View payslip → button</Td></tr>
              <tr><Td><Code>/schedule</Code></Td><Td>Sidebar → Schedule</Td></tr>
              <tr className="bg-stone-50"><td colSpan={2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">Finance & Collections</td></tr>
              <tr><Td><Code>/collections</Code></Td><Td>Sidebar → Collections</Td></tr>
              <tr><Td><Code>/transmittals</Code></Td><Td>Sidebar → Transmittals</Td></tr>
              <tr><Td><Code>/transmittals/[id]</Code></Td><Td>Transmittals → click any row</Td></tr>
              <tr><Td><Code>/banking</Code></Td><Td>Sidebar → Banking</Td></tr>
              <tr><Td><Code>/banking/[accountId]</Code></Td><Td>Banking → click any account</Td></tr>
              <tr><Td><Code>/finance</Code></Td><Td>Sidebar → Finance</Td></tr>
              <tr><Td><Code>/payables</Code></Td><Td>Sidebar → Payables</Td></tr>
              <tr><Td><Code>/payables/[id]</Code></Td><Td>Payables → click any row</Td></tr>
              <tr><Td><Code>/advances</Code></Td><Td>Sidebar → Advances</Td></tr>
              <tr><Td><Code>/advances/[id]</Code></Td><Td>Advances → click any row</Td></tr>
              <tr className="bg-stone-50"><td colSpan={2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">Buyers & Condo</td></tr>
              <tr><Td><Code>/buyers</Code></Td><Td>Sidebar → Buyers</Td></tr>
              <tr><Td><Code>/buyers/[id]</Code></Td><Td>Buyers → click any buyer row</Td></tr>
              <tr><Td><Code>/documents</Code></Td><Td>Sidebar → Documents</Td></tr>
              <tr><Td><Code>/documents/[buyerId]</Code></Td><Td>Documents → click any buyer folder</Td></tr>
              <tr><Td><Code>/condo</Code></Td><Td>Sidebar → Condo</Td></tr>
              <tr><Td><Code>/condo/[unitId]</Code></Td><Td>Condo → click any unit card</Td></tr>
              <tr><Td><Code>/condo/[unitId]/bill</Code></Td><Td>Condo unit → Monthly bill → button</Td></tr>
              <tr><Td><Code>/disputes</Code></Td><Td>Sidebar → Disputes</Td></tr>
              <tr><Td><Code>/repairs</Code></Td><Td>Sidebar → Repairs</Td></tr>
              <tr className="bg-stone-50"><td colSpan={2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">Operations & Inventory</td></tr>
              <tr><Td><Code>/housekeeping</Code></Td><Td>Sidebar → Housekeeping</Td></tr>
              <tr><Td><Code>/housekeeping/[id]</Code></Td><Td>Housekeeping → click any task card</Td></tr>
              <tr><Td><Code>/inventory</Code></Td><Td>Sidebar → Inventory</Td></tr>
              <tr><Td><Code>/incidents</Code></Td><Td>Sidebar → Incidents</Td></tr>
              <tr><Td><Code>/requisitions</Code></Td><Td>Sidebar → Requisitions</Td></tr>
              <tr><Td><Code>/forms</Code></Td><Td>Sidebar → Forms</Td></tr>
              <tr className="bg-stone-50"><td colSpan={2} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">System</td></tr>
              <tr><Td><Code>/users</Code></Td><Td>Sidebar → Users</Td></tr>
              <tr><Td><Code>/users/access</Code></Td><Td>Users → Access log button</Td></tr>
              <tr><Td><Code>/kiosk-access</Code></Td><Td>Sidebar → Kiosk Access</Td></tr>
              <tr><Td><Code>/notifications</Code></Td><Td>Bell icon in the top-right header</Td></tr>
              <tr><Td><Code>/dashboard</Code></Td><Td>Sidebar → Dashboard</Td></tr>
              <tr><Td><Code>/docs</Code></Td><Td>Sidebar → Docs / Changelog</Td></tr>
              <tr><Td><Code>/help</Code></Td><Td>Sidebar footer → Help link</Td></tr>
            </Table>
          </Section>
        )}

        {/* Footer */}
        <div className="mt-12 border-t border-stone-200 pt-4 text-center text-xs text-stone-400">
          {APP_BRAND} &nbsp;·&nbsp; For internal use only
        </div>

      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          nav, header, aside { display: none !important; }
          body { background: white !important; }
          .help-doc { max-width: 100% !important; }
          a { color: inherit !important; text-decoration: none !important; }
        }
      `}</style>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ id, title, who, children }: {
  id: string; title: string; who: string; children: React.ReactNode;
}) {
  return (
    <div id={id} className="mb-10">
      <div className="mb-4 flex items-center gap-3 border-b border-stone-200 pb-3">
        <h2 className="text-base font-bold text-stone-900">{title}</h2>
        <span className="ml-auto shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-500">{who}</span>
      </div>
      {children}
    </div>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 grid gap-2">{children}</div>;
}

function Step({ n, label, children }: { n: number | string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-[10px] font-bold text-amber-800 mt-0.5">
        {n}
      </div>
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-stone-800">{label}</p>
        <div className="mt-0.5 text-stone-500 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Callout({ type, children }: { type: "warn" | "tip" | "info"; children: React.ReactNode }) {
  const styles = { warn: "bg-orange-50 border-orange-200", tip: "bg-emerald-50 border-emerald-200", info: "bg-amber-50 border-amber-200" };
  const icons  = { warn: "⚠️", tip: "✅", info: "📋" };
  return (
    <div className={`my-3 flex gap-2 rounded-lg border p-3 text-sm text-stone-800 ${styles[type]}`}>
      <span className="shrink-0">{icons[type]}</span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

function Table({ heads, children }: { heads: string[]; children: React.ReactNode }) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-stone-200">
      <table className="w-full min-w-[400px] border-collapse bg-white text-sm">
        <thead className="bg-stone-50">
          <tr>{heads.map((h) => (
            <th key={h} className="border-b border-stone-200 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-stone-400">{h}</th>
          ))}</tr>
        </thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 align-top text-sm text-stone-700">{children}</td>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-amber-700">{children}</code>;
}
