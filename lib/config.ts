/**
 * Central, browser-safe app configuration.
 *
 * Prime directive: APP_BRAND is the ONLY brand string that may surface anywhere
 * in the shell, login, or printable reports. The GHL / GoHighLevel brand must
 * NEVER appear in the UI. Keep the string here and import it everywhere.
 *
 * Do NOT put secrets in this file — it is importable from client components.
 * Server-only env access lives in lib/env.ts.
 */

export const APP_BRAND =
  "Sun Miles Property Management Corporation — powered by BizAutoFlow";

// Short label. Deliberately avoids the acronym "PMS" (ambiguous — e.g.
// Preventive Maintenance Services in other industries). Spell out Property
// Management so the meaning is unmistakable.
export const APP_BRAND_SHORT = "Sun Miles Property Management";

/**
 * Business lines a unit can belong to. Recategorizing a unit between lines is a
 * data change (units.business_line), never a code change. This typed list is
 * only for consistent UI labels.
 * TODO(client-confirm): promote to a lookup table if a 5th line is ever needed.
 */
export const BUSINESS_LINES = [
  { key: "condo_sales", label: "Condo Sales" },
  { key: "rental", label: "Residential Rental" },
  { key: "hotel", label: "Hotel / Short-Stay" },
  { key: "airbnb", label: "Airbnb Pool" },
] as const;

export type BusinessLineKey = (typeof BUSINESS_LINES)[number]["key"];

/** Unit availability states (Section 4 / M1). */
export const UNIT_STATUSES = [
  "available",
  "occupied",
  "reserved",
  "under_maintenance",
  "blocked",
] as const;

export type UnitStatus = (typeof UNIT_STATUSES)[number];

/** Collection categories (broader than unit business lines — adds parking/utility). */
export const COLLECTION_CATEGORIES = [
  { key: "condo_sales", label: "Condo Sales" },
  { key: "rental", label: "Rental" },
  { key: "hotel", label: "Hotel / Short-Stay" },
  { key: "airbnb", label: "Airbnb" },
  { key: "parking", label: "Parking" },
  { key: "utility", label: "Utility" },
  { key: "other", label: "Other" },
] as const;

export type CollectionCategory = (typeof COLLECTION_CATEGORIES)[number]["key"];

/** Charge types for room-linked collections — what is being collected within a unit. */
export const COLLECTION_CHARGE_TYPES = [
  { key: "rent",          label: "Monthly Rent" },
  { key: "electric",      label: "Electricity (Meralco)" },
  { key: "water",         label: "Water" },
  { key: "dues",          label: "Association / Condo Dues" },
  { key: "parking",       label: "Parking Fee" },
  { key: "key_deposit",   label: "Key / Card Deposit" },
  { key: "miscellaneous", label: "Miscellaneous" },
] as const;

export type CollectionChargeType = (typeof COLLECTION_CHARGE_TYPES)[number]["key"];

/**
 * Unified item types for the rate-card & billing ledger system.
 * Each item_key maps to a label and which business lines it applies to.
 * TODO(client-confirm): add/remove items as needed without migration — only labels and BL lists.
 */
export const BILLING_ITEM_TYPES = [
  // --- Rental / Airbnb ---
  { key: "rent",            label: "Monthly Rent",             lines: ["rental", "airbnb"] },
  { key: "electric",        label: "Electricity (Meralco)",    lines: ["rental", "airbnb", "condo_sales"] },
  { key: "water",           label: "Water",                    lines: ["rental", "airbnb", "condo_sales"] },
  { key: "association_dues",label: "Association Dues",         lines: ["rental", "airbnb", "condo_sales"] },
  { key: "parking",         label: "Parking Fee",              lines: ["rental", "airbnb", "condo_sales"] },
  { key: "key_deposit",     label: "Key / Card Deposit",       lines: ["rental", "airbnb"] },
  // --- Condo Sales ---
  { key: "amortization",    label: "Monthly Amortization",     lines: ["condo_sales"] },
  { key: "downpayment",     label: "Down Payment",             lines: ["condo_sales"] },
  { key: "reservation",     label: "Reservation Fee",          lines: ["condo_sales"] },
  { key: "processing_fee",  label: "Processing / Admin Fee",   lines: ["condo_sales"] },
  { key: "transfer_fee",    label: "Transfer / Documentary",   lines: ["condo_sales"] },
  // --- Hotel ---
  { key: "room_charge",     label: "Room Charge",              lines: ["hotel"] },
  { key: "food_orders",     label: "Food & Beverage Orders",   lines: ["hotel"] },
  { key: "extra_services",  label: "Extra Services",           lines: ["hotel"] },
  // --- All / misc ---
  { key: "repairs",         label: "Repairs Charge",           lines: ["rental", "airbnb", "condo_sales"] },
  { key: "miscellaneous",   label: "Miscellaneous / Other",    lines: ["rental", "airbnb", "condo_sales", "hotel"] },
] as const;

export type BillingItemKey = (typeof BILLING_ITEM_TYPES)[number]["key"];

/** Returns item types that apply to a given business line. */
export function billingItemsForLine(businessLine: string) {
  return BILLING_ITEM_TYPES.filter((t) => (t.lines as readonly string[]).includes(businessLine));
}

/**
 * Bank account assignment by business line.
 * TODO(client-confirm): replace placeholder names with actual bank account names.
 * Value format: "Bank Name — Account / Branch"
 */
export const BANK_BY_BUSINESS_LINE: Record<string, string> = {
  condo_sales: "Sun Miles Condo Sales — BPI",       // TODO(client-confirm)
  rental:      "Sun Miles Rental — BDO",             // TODO(client-confirm)
  hotel:       "Sun Miles Hotel — BDO",              // TODO(client-confirm)
  airbnb:      "Sun Miles Airbnb — PNB",
  parking:     "Sun Miles Rental — BDO",             // parking under rental unless specified
  utility:     "Sun Miles Rental — BDO",             // utility under rental unless specified
  other:       "General — TBD",                      // TODO(client-confirm)
};

export const PAYMENT_TYPES = [
  { key: "cash", label: "Cash" },
  { key: "gcash", label: "GCash" },
  { key: "card", label: "Card" },
  { key: "bank_transfer", label: "Bank Transfer" },
  { key: "check", label: "Check" },
  { key: "other", label: "Other" },
] as const;

export type PaymentType = (typeof PAYMENT_TYPES)[number]["key"];

/** Buyer amortization schemes (M3). Scheme-specific terms live in computation_params. */
export const PAYMENT_SCHEMES = [
  { key: "fixed", label: "Fixed" },
  { key: "step_up", label: "Step Up" },
  { key: "balloon", label: "Balloon" },
] as const;

export type PaymentScheme = (typeof PAYMENT_SCHEMES)[number]["key"];

export const BUYER_STATUSES = [
  { key: "current", label: "Current" },
  { key: "overdue", label: "Overdue" },
  { key: "restructured", label: "Restructured" },
  { key: "in_dispute", label: "In dispute" },
] as const;

export type BuyerStatus = (typeof BUYER_STATUSES)[number]["key"];

export const PAYMENT_DOC_TYPES = [
  { key: "OR", label: "OR — Official Receipt" },
  { key: "SI", label: "SI — Sales Invoice" },
  { key: "AR", label: "AR — Acknowledgement Receipt" },
  { key: "PR", label: "PR — Provisional Receipt (postdated check)" },
] as const;

export type PaymentDocType = (typeof PAYMENT_DOC_TYPES)[number]["key"];

/** Dispute / case statuses (M5). */
export const DISPUTE_STATUSES = [
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "resolved", label: "Resolved" },
  { key: "escalated", label: "Escalated" },
] as const;

export type DisputeStatus = (typeof DISPUTE_STATUSES)[number]["key"];

/** Buyer document statuses (M4). */
export const DOCUMENT_STATUSES = [
  { key: "not_required", label: "Not required" },
  { key: "pending", label: "Pending" },
  { key: "received", label: "Received" },
  { key: "signed", label: "Signed" },
  { key: "filed", label: "Filed" },
  { key: "overdue", label: "Overdue" },
  { key: "disputed", label: "Disputed" },
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]["key"];

/** Document statuses that count a document as "done" for a milestone gate. */
export const DOC_DONE_STATUSES = ["received", "signed", "filed"] as const;

/** Milestone gates: reservation → CTS → loan → title. */
export const MILESTONE_GATES = [
  { key: "reservation", label: "Reservation" },
  { key: "cts", label: "Contract to Sell" },
  { key: "loan", label: "Loan Application" },
  { key: "title", label: "Title Transfer" },
] as const;

export type MilestoneGate = (typeof MILESTONE_GATES)[number]["key"];

/** Repair-request urgency, statuses, and common issue types (M7). */
export const REPAIR_URGENCY = [
  { key: "low", label: "Low" },
  { key: "normal", label: "Normal" },
  { key: "urgent", label: "Urgent" },
] as const;

export type RepairUrgency = (typeof REPAIR_URGENCY)[number]["key"];

export const REPAIR_STATUSES = [
  { key: "submitted", label: "Submitted" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
] as const;

export type RepairStatus = (typeof REPAIR_STATUSES)[number]["key"];

export const REPAIR_ISSUE_TYPES = [
  "Electrical",
  "Plumbing",
  "Aircon",
  "Appliance",
  "Structural",
  "Housekeeping",
  "Pest control",
  "Other",
] as const;

/** Hotel payment methods (M-Hotel). */
export const HOTEL_PAYMENT_METHODS = [
  { key: "cash", label: "Cash" },
  { key: "gcash", label: "GCash" },
  { key: "maya", label: "Maya" },
  { key: "bank_transfer", label: "Bank Transfer" },
] as const;

export type HotelPaymentMethod = (typeof HOTEL_PAYMENT_METHODS)[number]["key"];

export const HOTEL_MENU_CATEGORIES = [
  "Food",
  "Beverage",
  "Consumable",
  "Service",
  "Other",
] as const;

/** Tax modes (config-driven; accounting confirms which applies). */
export const TAX_MODES = [
  { key: "none", label: "No tax", defaultRate: 0 },
  { key: "vat_inclusive", label: "VAT-inclusive (12%)", defaultRate: 0.12 },
  { key: "non_vat", label: "Non-VAT (3% percentage)", defaultRate: 0.03 },
] as const;

export type TaxMode = (typeof TAX_MODES)[number]["key"];

/** Housekeeping (Hotel Phase C). */
export const HOUSEKEEPING_STATUSES = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Ready" },
] as const;

export type HousekeepingStatus = (typeof HOUSEKEEPING_STATUSES)[number]["key"];

export const HOUSEKEEPING_SHIFTS = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "night", label: "Night" },
] as const;

/**
 * Roles whose absence on a given day leaves a critical task unattended. The
 * schedule flags any day where fewer than `min` scheduled staff hold the role.
 * TODO(client-confirm): confirm the critical roles and minimum headcounts.
 */
export const CRITICAL_COVERAGE = [
  { role_key: "room_attendant", label: "Housekeeping", min: 1 },
  { role_key: "guard", label: "Security", min: 1 },
  { role_key: "hotel_cashier", label: "Hotel cashier", min: 1 },
] as const;

/** Pre-checkout room asset check (config-driven; TODO(client-confirm) counts). */
export const ROOM_ASSET_CHECKLIST = [
  { key: "pillows", label: "Pillows", expected: 2 },
  { key: "towels", label: "Bath towels", expected: 2 },
  { key: "blanket", label: "Blanket", expected: 1 },
  { key: "tv_remote", label: "TV remote", expected: 1 },
  { key: "ac_remote", label: "Aircon remote", expected: 1 },
  { key: "glass", label: "Drinking glass", expected: 2 },
  { key: "bath_soap", label: "Bath soap", expected: 1 },
] as const;

/** Cleaning task checklist. */
export const CLEANING_CHECKLIST = [
  { key: "linens", label: "Change bed linens" },
  { key: "bathroom", label: "Sanitize bathroom" },
  { key: "trash", label: "Empty trash" },
  { key: "restock", label: "Restock supplies" },
  { key: "floor", label: "Sweep & mop floor" },
  { key: "aircon", label: "Wipe aircon & vents" },
] as const;

/** Expense categories for P&L (Module 9). */
export const EXPENSE_CATEGORIES = [
  "Utilities",
  "Salaries & Wages",
  "Supplies",
  "Repairs & Maintenance",
  "Marketing",
  "Taxes & Licenses",
  "Professional Fees",
  "Rent",
  "Others",
] as const;

// Employee leave — TODO(client-confirm): confirm the leave types your company
// grants and which are paid. Editable here without a deploy.
export const LEAVE_TYPES = [
  "Vacation",
  "Sick",
  "Emergency",
  "Service Incentive Leave (SIL)",
  "Unpaid",
] as const;

export const LEAVE_STATUSES = [
  { key: "pending", label: "Pending", tone: "amber" },
  { key: "approved", label: "Approved", tone: "green" },
  { key: "rejected", label: "Rejected", tone: "red" },
  { key: "cancelled", label: "Cancelled", tone: "slate" },
] as const;

export type LeaveStatus = (typeof LEAVE_STATUSES)[number]["key"];

/** Minimum notice (days) a leave request should give before it starts. */
export const LEAVE_MIN_LEAD_DAYS = 3; // TODO(client-confirm)

/** Cash-advance workflow statuses. */
export const ADVANCE_STATUSES = [
  { key: "pending", label: "Pending", tone: "amber" },
  { key: "approved", label: "Approved", tone: "sky" },
  { key: "released", label: "Released", tone: "green" },
  { key: "liquidated", label: "Liquidated", tone: "slate" },
  { key: "rejected", label: "Rejected", tone: "red" },
  { key: "cancelled", label: "Cancelled", tone: "slate" },
] as const;

/** Rentals & Airbnb — utility types, due categories, billing cycles. */
export const UTILITY_TYPES = [
  { key: "electric", label: "Electric" },
  { key: "water", label: "Water" },
] as const;

export const RENTAL_DUE_CATEGORIES = [
  { key: "rent", label: "Rent" },
  { key: "association_dues", label: "Association dues" },
  { key: "electric", label: "Electric (Meralco)" },
  { key: "water", label: "Water" },
  { key: "parking", label: "Parking" },
  { key: "repairs", label: "Repairs" },
  { key: "other", label: "Other" },
] as const;

export const BILLING_CYCLES = [
  { key: "monthly", label: "Monthly" },
  { key: "nightly", label: "Nightly" },
] as const;

/** Lease/booking type — new vs renewal vs extension vs transfer. */
export const LEASE_TYPES = [
  { key: "new", label: "New" },
  { key: "renewal", label: "Renewal" },
  { key: "extension", label: "Extension" },
  { key: "transfer", label: "Transferred from another unit" },
] as const;

/** Documents a renter submits — checklist on the lease. */
export const LEASE_DOC_TYPES = [
  "Signed contract",
  "Valid ID",
  "Proof of address / billing",
  "Motor / plate registration",
  "Deposit / advance receipt",
  "Post-dated checks",
  "Emergency contact form",
  "Other",
] as const;

/** How many hours before an Airbnb checkout to flag "checkout soon". */
export const AIRBNB_CHECKOUT_SOON_HOURS = 3; // TODO(client-confirm)
/** How many days before/after a due date to flag "due soon / overdue". */
export const DUE_SOON_DAYS = 3; // TODO(client-confirm)

/** PHP bills & coins for the cash-count / transmittal denomination breakdown. */
export const PHP_DENOMINATIONS = [
  { value: 1000, kind: "bill" },
  { value: 500, kind: "bill" },
  { value: 200, kind: "bill" },
  { value: 100, kind: "bill" },
  { value: 50, kind: "bill" },
  { value: 20, kind: "bill" },
  { value: 20, kind: "coin" },
  { value: 10, kind: "coin" },
  { value: 5, kind: "coin" },
  { value: 1, kind: "coin" },
  { value: 0.25, kind: "coin" },
] as const;

/** Employment types for the 201 file — TODO(client-confirm). Editable here. */
export const EMPLOYMENT_TYPES = [
  "Regular",
  "Probationary",
  "Contractual",
  "Project-based",
  "Casual/Seasonal",
  "OJT",
  "Intern",
  "Consultant",
] as const;

/** Document categories for the employee 201 file. */
export const EMPLOYEE_DOC_TYPES = [
  "Resume / CV",
  "Employment contract",
  "Government IDs",
  "NBI / Police clearance",
  "Medical / Fit-to-work",
  "Certificate / Training",
  "Resignation / Clearance",
  "Other",
] as const;

/** Non-leave employee request types (share the same approval workflow). */
export const REQUEST_TYPES = [
  { key: "overtime", label: "Overtime", needsHours: true },
  { key: "undertime", label: "Undertime", needsHours: true },
  { key: "other", label: "Other request", needsHours: false },
] as const;

