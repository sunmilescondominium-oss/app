/**
 * Plain-language "what do I do" guides, keyed by ROLE (never by person).
 * Powers the dashboard Launch Pad so each staff member sees the steps for
 * their job with direct links. Add a role here and it just appears.
 */

export interface GuideStep {
  text: string;
  href?: string;
}
export interface RoleGuide {
  role: string;
  icon: string;
  headline: string;
  steps: GuideStep[];
}

export const ROLE_GUIDES: Record<string, RoleGuide> = {
  hotel_cashier: {
    role: "hotel_cashier",
    icon: "🧾",
    headline: "Take payments and hand over the cash",
    steps: [
      { text: "Guest pays in advance for the hours/rate they choose — record it on the room.", href: "/hotel" },
      { text: "Log every collection so it appears in the day's totals.", href: "/collections" },
      { text: "At end of shift, count the cash and build a transmittal.", href: "/transmittals" },
      { text: "Print it, then hand the cash + printed form to monitoring." },
    ],
  },
  hotel_rental_monitoring: {
    role: "hotel_rental_monitoring",
    icon: "🏨",
    headline: "Watch the rooms and re-count the cash",
    steps: [
      { text: "Check guests in and out on the room board; watch the stay timers.", href: "/hotel" },
      { text: "When the cashier hands over cash, open the transmittal and record your re-count, then transmit to the liaison.", href: "/transmittals" },
      { text: "Manage rentals & Airbnb bookings and dues.", href: "/rentals" },
      { text: "Set the receipt/AR number series if asked.", href: "/transmittals" },
    ],
  },
  errand_liaison: {
    role: "errand_liaison",
    icon: "🏦",
    headline: "Carry the cash to the bank",
    steps: [
      { text: "Receive the counted cash from monitoring (see the transmittal's chain of custody).", href: "/transmittals" },
      { text: "Get the bank passbook from accounting." },
      { text: "Count the cash, prepare the deposit slip, and pick the bank account on the transmittal.", href: "/transmittals" },
      { text: "Mark it deposited — this records the deposit against the bank account." },
    ],
  },
  accounting: {
    role: "accounting",
    icon: "📚",
    headline: "Reconcile money and manage the banks",
    steps: [
      { text: "Issue the passbook for each deposit and reconcile transmittals.", href: "/transmittals" },
      { text: "Manage bank accounts, deposits, check release and bank reconciliation.", href: "/banking" },
      { text: "Review payroll figures and staff performance.", href: "/hr" },
      { text: "Track income vs expenses on the P&L.", href: "/finance" },
    ],
  },
  room_attendant: {
    role: "room_attendant",
    icon: "🧹",
    headline: "Clean rooms and log supplies used",
    steps: [
      { text: "Open your housekeeping tasks (they appear when a guest checks out).", href: "/housekeeping" },
      { text: "Start the task, tick the checklist, add photos, then mark the room ready." },
      { text: "When you use supplies, record them in the dispensing log.", href: "/housekeeping" },
      { text: "Clock in and out at the kiosk — check your DTR & payslip in My Portal.", href: "/me" },
    ],
  },
  warehouse_timekeeper: {
    role: "warehouse_timekeeper",
    icon: "🕒",
    headline: "Track time and stock",
    steps: [
      { text: "Review the daily time records / DTR.", href: "/hr" },
      { text: "Set the weekly shift schedule.", href: "/schedule" },
      { text: "Receive stock and run the periodical physical count.", href: "/housekeeping" },
    ],
  },
  accounting_staff: {
    role: "accounting_staff",
    icon: "🧮",
    headline: "Support accounting tasks",
    steps: [
      { text: "Your access is granted per module by your supervisor — open the menu to see what's available." },
      { text: "Common areas: collections, transmittals, banking and finance (if granted).", href: "/collections" },
    ],
  },
  owner: {
    role: "owner",
    icon: "📊",
    headline: "See the business at a glance",
    steps: [
      { text: "Open the Owner Dashboard for the weekly overview and decisions.", href: "/owner" },
      { text: "Approve pending leave / requests when they appear." },
    ],
  },
  managing_officer: {
    role: "managing_officer",
    icon: "🧭",
    headline: "Oversee operations",
    steps: [
      { text: "Monitor collections, transmittals and reconciliation.", href: "/transmittals" },
      { text: "Approve requests and manage the team.", href: "/employees" },
      { text: "Set who can access what, and switch optional modules on/off.", href: "/users/access" },
    ],
  },
  operations_manager: {
    role: "operations_manager",
    icon: "🛠️",
    headline: "Keep daily operations running",
    steps: [
      { text: "Check housekeeping, repairs and rentals status.", href: "/housekeeping" },
      { text: "Receive stock and oversee the physical count.", href: "/housekeeping" },
      { text: "Approve cash advances and requests." },
    ],
  },
  admin: {
    role: "admin",
    icon: "⚙️",
    headline: "Run and configure the system",
    steps: [
      { text: "Manage users and their roles.", href: "/users" },
      { text: "Grant module access per role in Access Control.", href: "/users/access" },
      { text: "Turn optional modules (e.g. Cash Advance) on/off.", href: "/users" },
      { text: "Use 'Act as' (top-right) to preview any role for testing." },
    ],
  },
  guard: {
    role: "guard",
    icon: "🛡️",
    headline: "Log incidents and requests",
    steps: [
      { text: "Report maintenance issues via the repair board.", href: "/repairs" },
      { text: "Clock in and out at the kiosk; view your record in My Portal.", href: "/me" },
    ],
  },
  electrician: {
    role: "electrician",
    icon: "🔌",
    headline: "Handle assigned repairs",
    steps: [
      { text: "Pick up electrical/maintenance jobs from the repair board and update their status.", href: "/repairs" },
      { text: "Clock in and out at the kiosk; check My Portal.", href: "/me" },
    ],
  },
  utility: {
    role: "utility",
    icon: "🧰",
    headline: "Handle assigned tasks",
    steps: [
      { text: "Take repair / upkeep jobs from the board and update status.", href: "/repairs" },
      { text: "Clock in and out at the kiosk; check My Portal.", href: "/me" },
    ],
  },
  marketing_staff: {
    role: "marketing_staff",
    icon: "📣",
    headline: "Support sales & marketing",
    steps: [
      { text: "Your access is granted per module by your supervisor — open the menu to see what's available." },
      { text: "Common areas: buyers and documents (if granted).", href: "/buyers" },
    ],
  },
};

/** Generic fallback for roles without a specific guide. */
export const GENERIC_GUIDE: RoleGuide = {
  role: "generic",
  icon: "👋",
  headline: "Getting started",
  steps: [
    { text: "Use the menu on the left to open the modules you have access to." },
    { text: "Clock in and out at the kiosk; view your record in My Portal.", href: "/me" },
    { text: "Look for the “How this works” help on each screen if a step is unclear." },
  ],
};

/** Resolve the guides to show for a set of roles (dedup, ordered). */
export function guidesForRoles(roleKeys: readonly string[]): RoleGuide[] {
  const seen = new Set<string>();
  const out: RoleGuide[] = [];
  for (const r of roleKeys) {
    const g = ROLE_GUIDES[r];
    if (g && !seen.has(g.role)) {
      seen.add(g.role);
      out.push(g);
    }
  }
  return out.length ? out : [GENERIC_GUIDE];
}
