/**
 * Plain-language "what do I do" guides, keyed by ROLE (never by person).
 * Powers the dashboard Launch Pad so each staff member sees the steps for
 * their job with direct links. Add a role here and it just appears.
 */

import type { Lang } from "@/lib/i18n";

export interface GuideStep {
  text: string;
  /** Tagalog-English (Taglish) task wording — proper nouns kept as-is. */
  textFil?: string;
  href?: string;
}
export interface RoleGuide {
  role: string;
  icon: string;
  headline: string;
  headlineFil?: string;
  steps: GuideStep[];
}

/** Pick Filipino wording when present, else the English original. */
export function localizeGuide(g: RoleGuide, lang: Lang): RoleGuide {
  if (lang !== "fil") return g;
  return {
    ...g,
    headline: g.headlineFil ?? g.headline,
    steps: g.steps.map((s) => ({ ...s, text: s.textFil ?? s.text })),
  };
}

export const ROLE_GUIDES: Record<string, RoleGuide> = {
  hotel_cashier: {
    role: "hotel_cashier",
    icon: "🧾",
    headline: "Take payments and hand over the cash",
    headlineFil: "Tumanggap ng bayad at ibigay ang pera",
    steps: [
      { text: "Guest pays in advance for the hours/rate they choose — record it on the room.", textFil: "Magbabayad nang advance ang guest sa oras/rate na pinili — i-record sa kwarto.", href: "/hotel" },
      { text: "Log every collection so it appears in the day's totals.", textFil: "I-log ang bawat koleksyon para lumabas sa total ng araw.", href: "/collections" },
      { text: "At end of shift, count the cash and build a transmittal.", textFil: "Sa katapusan ng shift, bilangin ang pera at gumawa ng transmittal.", href: "/transmittals" },
      { text: "Print it, then hand the cash + printed form to monitoring.", textFil: "I-print, tapos ibigay ang pera + printed form sa monitoring." },
    ],
  },
  hotel_rental_monitoring: {
    role: "hotel_rental_monitoring",
    icon: "🏨",
    headline: "Watch the rooms and re-count the cash",
    headlineFil: "Bantayan ang mga kwarto at bilangin muli ang pera",
    steps: [
      { text: "Check guests in and out on the room board; watch the stay timers.", textFil: "I-check in/out ang guest sa room board; bantayan ang stay timers.", href: "/hotel" },
      { text: "When the cashier hands over cash, open the transmittal and record your re-count, then transmit to the liaison.", textFil: "Kapag inabot ng cashier ang pera, buksan ang transmittal, i-record ang re-count, tapos i-transmit sa liaison.", href: "/transmittals" },
      { text: "Manage rentals & Airbnb bookings and dues.", textFil: "Asikasuhin ang rentals & Airbnb bookings at dues.", href: "/rentals" },
      { text: "Set the receipt/AR number series if asked.", textFil: "Itakda ang receipt/AR number series kung kailangan.", href: "/transmittals" },
    ],
  },
  errand_liaison: {
    role: "errand_liaison",
    icon: "🏦",
    headline: "Carry the cash to the bank",
    headlineFil: "Dalhin ang pera sa bangko",
    steps: [
      { text: "Receive the counted cash from monitoring (see the transmittal's chain of custody).", textFil: "Tanggapin ang nabilang na pera mula sa monitoring (tingnan ang chain of custody ng transmittal).", href: "/transmittals" },
      { text: "Get the bank passbook from accounting.", textFil: "Kunin ang bank passbook sa accounting." },
      { text: "Count the cash, prepare the deposit slip, and pick the bank account on the transmittal.", textFil: "Bilangin ang pera, ihanda ang deposit slip, at piliin ang bank account sa transmittal.", href: "/transmittals" },
      { text: "Mark it deposited — this records the deposit against the bank account.", textFil: "I-mark na deposited — ita-tala nito ang deposito sa bank account." },
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
    headlineFil: "Maglinis ng kwarto at i-record ang gamit",
    steps: [
      { text: "Open your housekeeping tasks (they appear when a guest checks out).", textFil: "Buksan ang iyong housekeeping tasks (lalabas kapag nag-check out ang guest).", href: "/housekeeping" },
      { text: "Start the task, tick the checklist, add photos, then mark the room ready.", textFil: "Simulan ang task, i-tsek ang checklist, mag-photo, tapos i-Mark room ready." },
      { text: "When you use supplies, record them in the dispensing log.", textFil: "Kapag may ginamit na supplies, i-record sa dispensing log.", href: "/housekeeping" },
      { text: "Clock in and out at the kiosk — check your DTR & payslip in My Portal.", textFil: "Mag-time in/out sa kiosk — tingnan ang DTR at payslip sa My Portal.", href: "/me" },
    ],
  },
  warehouse_timekeeper: {
    role: "warehouse_timekeeper",
    icon: "🕒",
    headline: "Track time and stock",
    headlineFil: "Bantayan ang oras at stock",
    steps: [
      { text: "Review the daily time records / DTR.", textFil: "Suriin ang araw-araw na time record / DTR.", href: "/hr" },
      { text: "Set the weekly shift schedule.", textFil: "Itakda ang lingguhang shift schedule.", href: "/schedule" },
      { text: "Receive stock and run the periodical physical count.", textFil: "Tumanggap ng stock at magsagawa ng physical count.", href: "/housekeeping" },
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
      { text: "Grant module & photo/video evidence access to any role in Access Control.", href: "/users/access" },
    ],
  },
  consultant: {
    role: "consultant",
    icon: "🧠",
    headline: "Advise and oversee",
    steps: [
      { text: "Review the Owner Dashboard and reports.", href: "/owner" },
      { text: "Grant module & evidence access, or 'act as' any role, from Access Control.", href: "/users/access" },
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
    headlineFil: "I-record ang insidente at request",
    steps: [
      { text: "Report maintenance issues via the repair board.", textFil: "I-report ang sirang bagay sa repair board.", href: "/repairs" },
      { text: "Clock in and out at the kiosk; view your record in My Portal.", textFil: "Mag-time in/out sa kiosk; tingnan ang record sa My Portal.", href: "/me" },
    ],
  },
  electrician: {
    role: "electrician",
    icon: "🔌",
    headline: "Handle assigned repairs",
    headlineFil: "Asikasuhin ang naka-assign na repair",
    steps: [
      { text: "Pick up electrical/maintenance jobs from the repair board and update their status.", textFil: "Kunin ang electrical/maintenance jobs sa repair board at i-update ang status.", href: "/repairs" },
      { text: "Clock in and out at the kiosk; check My Portal.", textFil: "Mag-time in/out sa kiosk; tingnan ang My Portal.", href: "/me" },
    ],
  },
  utility: {
    role: "utility",
    icon: "🧰",
    headline: "Handle assigned tasks",
    headlineFil: "Asikasuhin ang naka-assign na gawain",
    steps: [
      { text: "Take repair / upkeep jobs from the board and update status.", textFil: "Kunin ang repair / upkeep jobs sa board at i-update ang status.", href: "/repairs" },
      { text: "Clock in and out at the kiosk; check My Portal.", textFil: "Mag-time in/out sa kiosk; tingnan ang My Portal.", href: "/me" },
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
  headlineFil: "Pagsisimula",
  steps: [
    { text: "Use the menu on the left to open the modules you have access to.", textFil: "Gamitin ang menu sa kaliwa para buksan ang mga module na puwede mo." },
    { text: "Clock in and out at the kiosk; view your record in My Portal.", textFil: "Mag-time in/out sa kiosk; tingnan ang record sa My Portal.", href: "/me" },
    { text: "Look for the “How this works” help on each screen if a step is unclear.", textFil: "Hanapin ang “How this works” na tulong sa bawat screen kung may hindi malinaw." },
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
