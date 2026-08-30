import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { APP_BRAND } from "@/lib/config";

export const metadata = { title: "Guard Post — Help" };

export default async function GuardHelpPage() {
  await requireModule("guard");

  return (
    <>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/guard" className="text-sm font-medium text-amber-700 hover:underline">
          ← Back to Guard Post
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

      <div className="mx-auto max-w-3xl guard-help">

        {/* Header */}
        <div className="mb-8 border-b-2 border-amber-600 pb-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-800">Sun Miles PMS</span>
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500">Help Docs</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Guard Post — Admin &amp; Management Guide</h1>
          <p className="mt-1 text-sm text-stone-500">Setup, onboarding, daily operations, and monitoring reference for the Guard Post module.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <span>Audience:</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Admin</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Consultant</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Managing Officer</span>
            <span className="ml-auto font-mono text-stone-400">app.sunmilescondo.com/guard</span>
          </div>
        </div>

        {/* TOC */}
        <div className="mb-8 rounded-xl border border-stone-200 bg-stone-50 px-5 py-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-stone-400">Contents</p>
          <ol className="grid gap-1 pl-4 text-sm">
            {[
              "Before the guard arrives — Admin setup",
              "Guard's first login — NDA acknowledgment",
              "Starting a shift",
              "Logging entries during a shift",
              "Ending a shift with handover",
              "Management monitoring",
              "Status reference",
            ].map((t, i) => (
              <li key={i}><a href={`#s${i + 1}`} className="text-amber-700 hover:underline">{t}</a></li>
            ))}
          </ol>
        </div>

        {/* ── Section 1 ── */}
        <Section id="s1" num="1" title="Before the guard arrives — Admin setup" who="Admin">
          <Callout type="warn">
            Complete all four steps below before the guard&apos;s first login. A guard without an operation area assigned <strong>cannot be tracked properly</strong> and will appear as a warning on the Guard Accounts page.
          </Callout>
          <Steps>
            <Step n={1} label="Create the guard's account">
              Go to <Code>/users</Code>, click <strong>Invite user</strong>, enter their email, and assign role <strong>Guard</strong>. They receive an invite email to set their own password.
            </Step>
            <Step n={2} label="Set operation area and contract details">
              <>
                Go to <Code>/guard/accounts</Code> → find the guard → <strong>Edit</strong>:
                <Table heads={["Field", "Value", "Required?"]}>
                  <tr><Td><strong>Operation</strong></Td><Td>Hotel Ops or Condo Ops</Td><Td red>Required</Td></tr>
                  <tr><Td><strong>Agency</strong></Td><Td>e.g. XYZ Security Agency</Td><Td muted>Optional</Td></tr>
                  <tr><Td><strong>Position</strong></Td><Td>e.g. Security Guard</Td><Td muted>Optional</Td></tr>
                  <tr><Td><strong>Contract expires</strong></Td><Td>End date of agency contract</Td><Td muted>Recommended</Td></tr>
                </Table>
              </>
            </Step>
            <Step n={3} label="Confirm no Unassigned warning on Guard Accounts">
              <>
                Return to <Code>/guard/accounts</Code>. The amber warning banner should be gone. Every guard should show a <Chip color="blue">Hotel Ops</Chip> or <Chip color="green">Condo Ops</Chip> chip.
              </>
            </Step>
            <Step n={4} label="(Optional) Print a deployment letter">
              <>
                On <Code>/guard/accounts</Code>, click <strong>Print letter</strong> next to any guard to generate a formal deployment letter for agency records.
              </>
            </Step>
          </Steps>
        </Section>

        {/* ── Section 2 ── */}
        <Section id="s2" num="2" title="Guard's first login — NDA acknowledgment" who="Guard">
          <Callout type="info">
            <strong>One-time only.</strong> The guard must read and accept the Non-Disclosure &amp; Conduct Agreement before accessing the Guard Post. The acknowledgment is timestamped and visible to management on <Code>/guard/accounts</Code>.
          </Callout>
          <Steps>
            <Step n={1} label="Guard logs in">
              Open <strong>app.sunmilescondo.com</strong> and sign in. On first login the system sends a password-set link — the guard sets their own password before proceeding.
            </Step>
            <Step n={2} label="Guard reads and acknowledges the NDA">
              <>
                Navigating to <Code>/guard</Code> shows the Non-Disclosure &amp; Conduct Agreement. After reading, the guard clicks <strong>I Acknowledge — Proceed to Guard Portal</strong>. The portal opens immediately.
              </>
            </Step>
            <Step n={3} label="Admin verifies acknowledgment">
              <>
                On <Code>/guard/accounts</Code>, the guard&apos;s row should show <strong>NDA ack&apos;d: [date]</strong> instead of the <Chip color="amber">NDA pending</Chip> chip.
              </>
            </Step>
          </Steps>
        </Section>

        {/* ── Section 3 ── */}
        <Section id="s3" num="3" title="Starting a shift" who="Guard">
          <Steps>
            <Step n={1} label="Read the previous guard's handover (if any)">
              If the outgoing guard left notes, an amber card appears showing their incidents and pending items. The incoming guard must click <strong>I&apos;ve read this — Acknowledge</strong> before the Start Shift form becomes active.
            </Step>
            <Step n={2} label="Select post and shift type, then start">
              <>
                Choose the assigned <strong>Post</strong>, then select <strong>Shift type</strong>:
                <ul className="mt-1.5 list-disc pl-4 text-xs">
                  <li><strong>Day</strong> — 06:00 to 18:00</li>
                  <li><strong>Night</strong> — 18:00 to 06:00</li>
                </ul>
                <p className="mt-1.5">Click <strong>Start Shift</strong>. The panel turns green showing 🟢 On Duty with the post name and start time.</p>
              </>
            </Step>
          </Steps>
          <Callout type="warn">
            Only <strong>one active shift per guard</strong> at a time. The shift must be properly ended with a handover before a new one can start.
          </Callout>
        </Section>

        {/* ── Section 4 ── */}
        <Section id="s4" num="4" title="Logging entries during a shift" who="Guard">
          <p className="mb-3 text-sm text-stone-500">Every person or vehicle entering the property must be logged. The entry form is only visible while a shift is active.</p>
          <Table heads={["Field", "When to fill", "Notes"]}>
            <tr><Td><strong>Entry type</strong></Td><Td red>Always required</Td><Td>🛎 Guest | 🚗 Vehicle only | 👤 Visitor | 📦 Delivery | 🪪 Staff</Td></tr>
            <tr><Td><strong>Vehicle type</strong></Td><Td muted>If a vehicle</Td><Td>Tricycle, Car, Van, Motorcycle, Other</Td></tr>
            <tr><Td><strong>Plate #</strong></Td><Td muted>If vehicle has plate</Td><Td>Auto-uppercased. e.g. ABC 123</Td></tr>
            <tr><Td><strong>Passengers</strong></Td><Td muted>If multiple persons</Td><Td>Number of people in/with the vehicle</Td></tr>
            <tr><Td><strong>Driver name</strong></Td><Td muted>Optional</Td><Td>Full name of driver or person entering</Td></tr>
            <tr><Td><strong>Notes</strong></Td><Td muted>Optional</Td><Td>Any remarks or observations</Td></tr>
            <tr><Td><strong>Discount coupon / card #</strong></Td><Td amber>If guest has coupon</Td><Td><strong>Important:</strong> cashier cannot apply coupon-based promos unless recorded at the gate first</Td></tr>
          </Table>
          <Callout type="tip">
            After clicking <strong>Log Entry →</strong>, the form resets and shows ✓ Entry logged. To record when someone leaves, find their entry in <strong>Today&apos;s log</strong> and tap the time-out button.
          </Callout>
        </Section>

        {/* ── Section 5 ── */}
        <Section id="s5" num="5" title="Ending a shift with handover" who="Guard">
          <Callout type="warn">
            Guards must always end their shift through the system. The handover notes are timestamped and the next guard must read and acknowledge them before starting.
          </Callout>
          <Steps>
            <Step n={1} label="Click End Shift">
              The green On Duty panel shows an <strong>End Shift</strong> button. Clicking it opens the handover form.
            </Step>
            <Step n={2} label="Fill in handover notes">
              <>
                <p><strong>Incidents / observations</strong> — anything notable during the shift (suspicious persons, disputes, accidents). Leave blank if uneventful.</p>
                <p className="mt-1"><strong>Pending items</strong> — things for the next guard to follow up on (a visitor still inside, an expected delivery, an open issue).</p>
              </>
            </Step>
            <Step n={3} label="Click Submit handover and end shift">
              The shift closes and the handover is queued for the next guard. The portal returns to Off Duty state.
            </Step>
          </Steps>
        </Section>

        {/* ── Section 6 ── */}
        <Section id="s6" num="6" title="Management monitoring" who="Admin / Management">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {[
              { path: "/guard", label: "Guard Post", desc: "Live entrance log, shift status badge, persons currently inside counter" },
              { path: "/guard/accounts", label: "Guard Accounts", desc: "All guards, operation area, NDA status, contract expiry, print deployment letter" },
              { path: "/guard/referrals", label: "Referral Drivers", desc: "Registry of accredited referral drivers used for guest tracking" },
              { path: "/me", label: "My Portal (guard view)", desc: "Guard sees duty hours only — no payslip, no leave or OB/OT requests" },
            ].map((p) => (
              <div key={p.path} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{p.label}</p>
                <p className="mt-0.5 font-mono text-xs text-amber-700">{p.path}</p>
                <p className="mt-1 text-xs text-stone-600">{p.desc}</p>
              </div>
            ))}
          </div>
          <Steps>
            <Step n="!" label="Contract expiry alerts">
              <>
                When a guard&apos;s contract is within <strong>7 days of expiry</strong>, a warning banner appears on their Guard Post. When expired, access is blocked. Renew via <Code>/guard/accounts</Code> → Edit → update expiry date.
              </>
            </Step>
            <Step n="!" label="Guards do not use the HR clock-in kiosk">
              <>
                Duty hours are recorded through shift start/end in the Guard Post — <strong>not</strong> the employee kiosk at <Code>/kiosk</Code>. Guard duty hours are viewable on their <Code>/me</Code> portal page.
              </>
            </Step>
            <Step n="!" label="Guards have no payroll in the system">
              Guard compensation is handled through the agency. The system tracks duty hours and the entrance log only. No payslip, leave requests, OB, or OT.
            </Step>
          </Steps>
        </Section>

        {/* ── Section 7 ── */}
        <Section id="s7" num="7" title="Status reference" who="All">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { chip: "Hotel Ops",    color: "blue"  as const, meaning: "Assigned to hotel gate / hotel area" },
              { chip: "Condo Ops",   color: "green" as const, meaning: "Assigned to condo entrance / condo area" },
              { chip: "Unassigned",  color: "stone" as const, meaning: "Operation area not set — edit immediately" },
              { chip: "NDA pending", color: "amber" as const, meaning: "Guard has not acknowledged the agreement yet" },
              { chip: "Expired",     color: "red"   as const, meaning: "Contract expired — access is blocked" },
              { chip: "Off duty",    color: "red"   as const, meaning: "No active shift — no entries can be logged" },
            ].map((s) => (
              <div key={s.chip} className="rounded-lg border border-stone-200 bg-white p-3">
                <Chip color={s.color}>{s.chip}</Chip>
                <p className="mt-2 text-xs text-stone-500">{s.meaning}</p>
              </div>
            ))}
          </div>
        </Section>

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
          .guard-help { max-width: 100% !important; }
          a { color: inherit !important; text-decoration: none !important; }
        }
      `}</style>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ id, num, title, who, children }: {
  id: string; num: string | number; title: string; who: string; children: React.ReactNode;
}) {
  return (
    <div id={id} className="mb-10">
      <div className="mb-4 flex items-center gap-3 border-b border-stone-200 pb-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white">
          {num}
        </div>
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
      <table className="w-full min-w-[480px] border-collapse bg-white text-sm">
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

function Td({ children, red, muted, amber }: { children: React.ReactNode; red?: boolean; muted?: boolean; amber?: boolean }) {
  const cls = red ? "font-semibold text-red-700" : muted ? "text-stone-400" : amber ? "font-semibold text-amber-700" : "text-stone-700";
  return <td className={`px-3 py-2 align-top text-sm ${cls}`}>{children}</td>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-amber-700">{children}</code>;
}

function Chip({ color, children }: { color: "amber" | "green" | "blue" | "red" | "stone"; children: React.ReactNode }) {
  const styles = {
    amber: "bg-amber-100 text-amber-800",
    green: "bg-emerald-100 text-emerald-700",
    blue:  "bg-blue-100 text-blue-800",
    red:   "bg-red-100 text-red-700",
    stone: "bg-stone-100 text-stone-500",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[color]}`}>{children}</span>;
}
