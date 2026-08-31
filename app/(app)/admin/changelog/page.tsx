import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "System Changelog" };

interface ChangeEntry {
  date: string;
  tag: "fix" | "feature" | "improvement" | "security";
  title: string;
  details: string[];
}

const CHANGELOG: ChangeEntry[] = [
  {
    date: "2026-08-31",
    tag: "improvement",
    title: "Collections table: column reorder, Time column, same-stay Room Total",
    details: [
      "Column order is now: Category → Unit → Time → Charge/Stay → Room Total → Amount Paid → AR No → Payment → Collected By → Receipt #.",
      "New 'Time' column shows when each collection was recorded — this is exactly what the Time sort button was already sorting by, now made visible.",
      "Room Total suppresses duplicates: when one stay has multiple collection rows (e.g. ₱350 room + ₱40 bottled water paid separately), the full breakdown appears only on the first row; subsequent rows for the same stay show '↑ same stay' instead of repeating ₱390.",
      "Receipt # moved to the last column before the action buttons.",
    ],
  },
  {
    date: "2026-08-31",
    tag: "feature",
    title: "Hotel cashier: Start Counting & Bagging button with 20-min cutoff",
    details: [
      "New 'Start Counting & Bagging' button on the /hotel/shifts page lets the on-duty cashier manually initiate the collection cutoff.",
      "Clicking sets collection_starts_at = NOW() and collection_ends_at = NOW() + 20 minutes on the active session.",
      "A live mm:ss countdown replaces the button and shows how long the 20-minute grace window has remaining.",
      "After the window closes, a green confirmation appears: 'Bagging window closed — you may now close your shift.'",
      "Hotel Ops page shows a 'Bagging in progress' warning banner while the window is open so the cashier knows while processing last guests.",
      "The shift report's existing pre/post cutoff split automatically uses this manual cutoff time — no DB migration required.",
      "Active session banner on /hotel/shifts switches from the fixed '5:40 PM / 5:40 AM' label to the actual manual bagging cutoff time once triggered.",
    ],
  },
  {
    date: "2026-08-31",
    tag: "fix",
    title: "Hotel collection report and AR register: correct DB column names",
    details: [
      "Queries were referencing checked_in_at / checked_out_at which do not exist in the stays table — the correct columns are check_in_at / check_out_at.",
      "Supabase silently returns null for unknown columns, causing raw UUIDs instead of room numbers, ₱0 room charges, and 'unknown' status to appear in the hotel collection report.",
      "Fixed in lib/hotel/collection-report.ts, lib/collections/queries.ts, and lib/hotel/ar-register.ts.",
    ],
  },
  {
    date: "2026-08-31",
    tag: "fix",
    title: "Hotel collection report: per-stay redesign with timestamp matching",
    details: [
      "Report was showing all payments for a unit on one row (per-room model), making it impossible to distinguish multiple guests using the same room in one day.",
      "Redesigned to a per-stay model: each guest check-in produces its own row with correct charge and payment matching.",
      "Collections are matched to stays using a 30-minute grace window after checkout so late-entered payments still attribute correctly.",
      "Results sorted by unit number then check-in time.",
      "Detailed incidental line items (e.g. Bottled Water ₱40) now appear in the Payments column.",
    ],
  },
  {
    date: "2026-08-31",
    tag: "fix",
    title: "Chat permissions: all role pairs shown even with empty DB table",
    details: [
      "The chat_role_permissions table starts empty so the page was showing no controls.",
      "Page now generates all N×N staff-role pairs client-side from a hardcoded STAFF_ROLES list and merges with DB for enabled/disabled state.",
      "Management roles (admin, managing_officer, consultant) can always chat all staff — no DB row needed.",
      "Staff can always initiate chat with management — also requires no DB row.",
    ],
  },
  {
    date: "2026-08-31",
    tag: "improvement",
    title: "Collections table: room billing detail inline",
    details: [
      "Hotel/short-stay rows now show Room total (room charge + extra persons + incidentals + discount) directly in the table — no need to open the hotel room report for a quick figure.",
      "Charge/time column now shows planned hours and check-in → check-out time (or 'active') instead of a blank dash.",
      "Guest name appears below the unit number for hotel rows.",
      "Non-hotel rows are unaffected.",
    ],
  },
  {
    date: "2026-08-31",
    tag: "fix",
    title: "Hotel collection report: previous-day data now loads",
    details: [
      "Report was showing 0 results for past dates because it filtered by check-in date instead of payment date.",
      "Query now mirrors the AR register approach — starts from stay_payments.paid_at so 'previous day operation' correctly shows all payments collected on that day.",
      "Status badge fixed: 'active' now shows as Checked In (green), 'checked_out' as Checked Out (grey).",
    ],
  },
  {
    date: "2026-08-31",
    tag: "feature",
    title: "System Health: Vercel invocation monitoring",
    details: [
      "New Vercel Invocations card on the System Health page shows the 1M/month Hobby limit with a live progress bar.",
      "Shows a critical warning (🚨) when at 100% — Vercel pauses the project at this point.",
      "Fetches live data from the Vercel API if VERCEL_API_TOKEN + VERCEL_TEAM_ID are set in environment variables.",
      "When token is not set, shows the Aug 27 email notification as a manual alert with setup instructions.",
      "Bandwidth (100 GB/month) also tracked.",
    ],
  },
  {
    date: "2026-08-30",
    tag: "feature",
    title: "Hotel collection report: per-room itemized view",
    details: [
      "New page at /hotel/collection-report accessible from the Collections page (Hotel room report →) and the Hotel Ops page.",
      "Shows every room active on the selected date with: guest name, status, check-in/out time, hours, itemized charges (room rate, extra persons, incidentals), payments, and balance.",
      "Summary bar shows rooms/stays count, total collected, total charges, outstanding balance.",
      "Printable via browser print.",
    ],
  },
  {
    date: "2026-08-30",
    tag: "fix",
    title: "Guard RBAC corrections",
    details: [
      "Guards (third-party security agency staff) are now excluded from: My Portal (payslip, DTR, leave, OB), kiosk clock-in, and cash advance.",
      "Introduced EMPLOYEE_ROLE_KEYS constant that excludes 'guard' from the employee/HR module group.",
    ],
  },
  {
    date: "2026-08-30",
    tag: "fix",
    title: "Nav: duplicate Messages button removed",
    details: [
      "A hardcoded /chat nav block was duplicating the RBAC-driven module entry.",
      "Removed hardcoded block; unread badge moved into the RBAC modules.map() loop.",
    ],
  },
  {
    date: "2026-08-30",
    tag: "fix",
    title: "Nav: Documentation highlighted Help & Docs simultaneously",
    details: [
      "helpActive condition was matching both /help and /docs routes, causing both to highlight.",
      "Fixed to match /help only.",
    ],
  },
  {
    date: "2026-08-30",
    tag: "improvement",
    title: "Chat: dropdown to start or open conversations",
    details: [
      "Replaced the expanding '+ New' panel with a single-select dropdown listing all chattable staff.",
      "Selecting a name navigates directly to that conversation.",
    ],
  },
  {
    date: "2026-08-30",
    tag: "improvement",
    title: "AR Register: check-in / check-out time in expanded card",
    details: [
      "Expanded payment card now shows a time period strip (check-in, check-out or planned hours, actual hours) above the itemized breakdown.",
    ],
  },
];

const TAG_STYLE: Record<ChangeEntry["tag"], string> = {
  feature:     "bg-emerald-100 text-emerald-800",
  fix:         "bg-rose-100 text-rose-800",
  improvement: "bg-amber-100 text-amber-800",
  security:    "bg-violet-100 text-violet-800",
};

const TAG_LABEL: Record<ChangeEntry["tag"], string> = {
  feature:     "Feature",
  fix:         "Fix",
  improvement: "Improvement",
  security:    "Security",
};

function formatDate(d: string) {
  return new Date(d + "T00:00:00+08:00").toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric",
  });
}

export default async function ChangelogPage() {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "managing_officer", "consultant"])) {
    return <p className="p-8 text-sm text-stone-500">Access denied.</p>;
  }

  // Group by date
  const byDate = CHANGELOG.reduce<Record<string, ChangeEntry[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <>
      <PageHeader
        backHref="/admin"
        title="System Changelog"
        subtitle="Recent features, fixes, and improvements to the Sun Miles PMS."
      />

      <div className="space-y-8">
        {dates.map((date) => (
          <div key={date}>
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-sm font-bold text-stone-700">{formatDate(date)}</h2>
              <div className="flex-1 border-t border-stone-200" />
            </div>
            <div className="space-y-3">
              {byDate[date].map((entry, i) => (
                <div key={i} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex flex-wrap items-start gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TAG_STYLE[entry.tag]}`}>
                      {TAG_LABEL[entry.tag]}
                    </span>
                    <p className="text-sm font-semibold text-stone-800">{entry.title}</p>
                  </div>
                  <ul className="mt-2 space-y-1 pl-3">
                    {entry.details.map((d, j) => (
                      <li key={j} className="relative text-xs text-stone-600 before:absolute before:-left-3 before:text-stone-300 before:content-['·']">
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
