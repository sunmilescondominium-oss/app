/**
 * Role-Based Access Control map — the single source of truth.
 *
 * Section 7 of the build brief is a working draft, so the ENTIRE access map
 * lives in this one file: refining who can read/write a module is an edit here
 * and nowhere else. No feature code hardcodes role checks.
 *
 * TODO(client-confirm): exact per-role WRITE permissions still to be confirmed.
 */

export const ALL_ROLE_KEYS = [
  "owner", "consultant", "managing_officer", "operations_manager", "accounting",
  "admin", "hotel_rental_monitoring", "hotel_cashier", "room_attendant", "guard",
  "electrician", "utility", "warehouse_timekeeper", "errand_liaison",
  "broker", "buyer", "tenant", "guest",
] as const;

export type RoleKey = (typeof ALL_ROLE_KEYS)[number];

/**
 * External, self-service roles. They never sign into the staff app:
 * buyer/tenant/guest use public PIN / booking-ref portals; the broker portal
 * is Phase 3. Kept here so staff/external is derived, not hardcoded twice.
 */
export const EXTERNAL_ROLE_KEYS = ["broker", "buyer", "tenant", "guest"] as const;

/** Staff roles = everything that is not external. */
export const STAFF_ROLE_KEYS: RoleKey[] = ALL_ROLE_KEYS.filter(
  (r) => !(EXTERNAL_ROLE_KEYS as readonly string[]).includes(r),
);

export type ModuleKey =
  | "inventory"
  | "collections"
  | "transmittals"
  | "buyers"
  | "documents"
  | "disputes"
  | "repair"
  | "hotel"
  | "rentals"
  | "condo"
  | "housekeeping"
  | "owner"
  | "finance"
  | "banking"
  | "hr"
  | "employee"
  | "employees"
  | "advances"
  | "scheduling"
  | "users";

/** Roles that may approve/reject leave — TODO(client-confirm). Owner included so
 *  the owner can act on requests surfaced in the Owner Dashboard. */
export const LEAVE_APPROVER_ROLES: RoleKey[] = ["owner", "admin", "managing_officer", "operations_manager"];

/** Roles that may approve a cash advance, and roles that may release/disburse it. */
export const ADVANCE_APPROVER_ROLES: RoleKey[] = ["admin", "managing_officer", "operations_manager", "accounting"];
export const ADVANCE_RELEASE_ROLES: RoleKey[] = ["accounting", "admin"];

export interface ModuleDef {
  key: ModuleKey;
  path: string;
  label: string;
  blurb: string;
  milestone: string;
  /** Roles that may READ the module (and therefore see it in the nav). */
  read: readonly RoleKey[];
  /** Roles that may WRITE within the module. */
  write: readonly RoleKey[];
}

export const MODULES: Record<ModuleKey, ModuleDef> = {
  inventory: {
    key: "inventory",
    path: "/inventory",
    label: "Inventory",
    blurb: "Property & unit / room registry.",
    milestone: "M1",
    // Only roles that actually work with inventory — errand/liaison, room
    // attendant, guard, utility, etc. are intentionally excluded.
    read: ["admin", "managing_officer", "operations_manager", "consultant", "accounting", "hotel_rental_monitoring", "hotel_cashier"],
    write: ["admin", "operations_manager", "managing_officer"],
  },
  collections: {
    key: "collections",
    path: "/collections",
    label: "Collections",
    blurb: "Daily collections & cash transmittal.",
    milestone: "M2",
    // Governance: the owner is intentionally EXCLUDED here — the owner sees the
    // simplified Owner Dashboard only; their daily total is surfaced there.
    read: ["managing_officer", "consultant", "accounting", "hotel_rental_monitoring"],
    write: ["hotel_rental_monitoring", "accounting"],
  },
  transmittals: {
    key: "transmittals",
    path: "/transmittals",
    label: "Transmittals",
    blurb: "Cash transmittal & bank deposit.",
    milestone: "M2",
    read: ["accounting", "errand_liaison", "hotel_rental_monitoring", "managing_officer", "hotel_cashier"],
    write: ["hotel_rental_monitoring", "accounting", "errand_liaison", "managing_officer", "hotel_cashier"],
  },
  buyers: {
    key: "buyers",
    path: "/buyers",
    label: "Buyers",
    blurb: "Buyer accounts, SOA & payment history.",
    milestone: "M3–M4",
    read: ["accounting", "admin", "consultant", "managing_officer"],
    write: ["accounting", "admin"],
  },
  documents: {
    key: "documents",
    path: "/documents",
    label: "Documents",
    blurb: "Per-buyer document tracker.",
    milestone: "M4",
    read: ["admin", "accounting", "consultant", "managing_officer"],
    write: ["admin", "accounting"],
  },
  disputes: {
    key: "disputes",
    path: "/disputes",
    label: "Disputes",
    blurb: "Case log per unit.",
    milestone: "M5",
    read: ["consultant", "managing_officer", "operations_manager"],
    write: ["consultant", "admin"],
  },
  repair: {
    key: "repair",
    path: "/repairs",
    label: "Repair Requests",
    blurb: "Tenant & guest repair tickets.",
    milestone: "M7",
    read: ["operations_manager", "electrician", "utility", "admin"],
    write: ["operations_manager", "electrician", "utility", "admin"],
  },
  hotel: {
    key: "hotel",
    path: "/hotel",
    label: "Hotel Ops",
    blurb: "Room board, stays & receipts.",
    milestone: "Hotel",
    // room_attendant intentionally excluded — they use Housekeeping only and must
    // not see folio payments / the cashier's remittance report.
    read: ["hotel_cashier", "hotel_rental_monitoring", "operations_manager", "managing_officer", "admin"],
    write: ["hotel_cashier", "hotel_rental_monitoring", "admin"],
  },
  rentals: {
    key: "rentals",
    path: "/rentals",
    label: "Rentals & Airbnb",
    blurb: "Occupancy, dues, meter readings.",
    milestone: "B",
    read: ["admin", "managing_officer", "operations_manager", "accounting", "hotel_rental_monitoring"],
    write: ["admin", "managing_officer", "operations_manager", "accounting", "hotel_rental_monitoring"],
  },
  condo: {
    key: "condo",
    path: "/condo",
    label: "Condo Dues",
    blurb: "Association dues, utilities & billing.",
    milestone: "B",
    read: ["admin", "managing_officer", "operations_manager", "accounting", "hotel_rental_monitoring"],
    write: ["admin", "managing_officer", "operations_manager", "accounting", "hotel_rental_monitoring"],
  },
  housekeeping: {
    key: "housekeeping",
    path: "/housekeeping",
    label: "Housekeeping",
    blurb: "Room cleaning, supplies & turnover.",
    milestone: "Hotel-C",
    read: ["room_attendant", "hotel_cashier", "hotel_rental_monitoring", "operations_manager", "managing_officer", "admin"],
    write: ["room_attendant", "operations_manager", "admin"],
  },
  owner: {
    key: "owner",
    path: "/owner",
    label: "Owner Dashboard",
    blurb: "Simplified weekly overview.",
    milestone: "M6",
    read: ["owner", "managing_officer", "consultant"],
    write: [],
  },
  finance: {
    key: "finance",
    path: "/finance",
    label: "P&L / Reports",
    blurb: "Sales, expenses & profit.",
    milestone: "M9",
    read: ["owner", "managing_officer", "consultant", "accounting", "admin"],
    write: ["accounting", "admin"],
  },
  banking: {
    key: "banking",
    path: "/banking",
    label: "Bank & Reconciliation",
    blurb: "Bank accounts, deposits, checks & reconciliation.",
    milestone: "M9",
    read: ["owner", "managing_officer", "consultant", "accounting", "admin"],
    write: ["accounting", "admin"],
  },
  hr: {
    key: "hr",
    path: "/hr",
    label: "HR / Payroll",
    blurb: "DTR & payroll summary.",
    milestone: "M8",
    read: ["warehouse_timekeeper", "accounting", "admin", "managing_officer"],
    write: ["admin", "accounting"],
  },
  employee: {
    key: "employee",
    path: "/me",
    label: "My Portal",
    blurb: "My attendance, payslip & leave.",
    milestone: "M8",
    read: STAFF_ROLE_KEYS,
    write: STAFF_ROLE_KEYS,
  },
  employees: {
    key: "employees",
    path: "/employees",
    label: "Employees",
    blurb: "Staff roster, photos & leave approvals.",
    milestone: "M8",
    // Roster viewers + photo uploaders — HR / admin / consultant / ops / top users.
    // (warehouse_timekeeper handles only DTR + shift scheduling, not the roster.)
    read: ["owner", "admin", "managing_officer", "operations_manager", "consultant", "accounting"],
    write: ["admin", "managing_officer", "operations_manager", "consultant", "accounting"],
  },
  advances: {
    key: "advances",
    path: "/advances",
    label: "Cash Advance",
    blurb: "Requests, approval & liquidation.",
    milestone: "C",
    read: ["admin", "managing_officer", "operations_manager", "accounting", "consultant", "errand_liaison", "hotel_rental_monitoring", "hotel_cashier"],
    write: ["admin", "managing_officer", "operations_manager", "accounting", "consultant", "errand_liaison", "hotel_rental_monitoring", "hotel_cashier"],
  },
  scheduling: {
    key: "scheduling",
    path: "/schedule",
    label: "Shift Schedule",
    blurb: "Assign staff shifts per day.",
    milestone: "M8",
    read: ["admin", "managing_officer", "operations_manager", "warehouse_timekeeper"],
    write: ["admin", "managing_officer", "operations_manager", "warehouse_timekeeper"],
  },
  users: {
    key: "users",
    path: "/users",
    label: "Users & Roles",
    blurb: "Staff accounts & access.",
    milestone: "Admin",
    // TODO(client-confirm): should managing_officer also be able to edit users?
    read: ["admin", "managing_officer"],
    write: ["admin"],
  },
};

export const MODULE_LIST: ModuleDef[] = Object.values(MODULES);

/** Modules the given roles may see in the nav (dedup + preserves declared order). */
export function accessibleModules(roleKeys: readonly string[]): ModuleDef[] {
  const set = new Set(roleKeys);
  return MODULE_LIST.filter((m) => m.read.some((r) => set.has(r)));
}

export function canReadModule(roleKeys: readonly string[], key: ModuleKey): boolean {
  const set = new Set(roleKeys);
  return MODULES[key].read.some((r) => set.has(r));
}

export function canWriteModule(roleKeys: readonly string[], key: ModuleKey): boolean {
  const set = new Set(roleKeys);
  return MODULES[key].write.some((r) => set.has(r));
}
