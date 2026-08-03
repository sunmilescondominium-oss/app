// Transmittal chain of custody — stage metadata shared by server & client.
// Role-based only (no names). Admin / managing officer may act on any stage.

export type CustodyStage =
  | "cashier_count"
  | "monitoring_recount"
  | "passbook_issued"
  | "liaison_count"
  | "deposited";

export const CUSTODY_ORDER: CustodyStage[] = [
  "cashier_count",
  "monitoring_recount",
  "passbook_issued",
  "liaison_count",
  "deposited",
];

export interface CustodyStageDef {
  key: CustodyStage;
  label: string;
  /** Roles that normally perform this hop (besides admin / managing officer). */
  actorRoles: string[];
  blurb: string;
  /** Fields this hop captures. */
  needs: { counted?: boolean; passbook?: boolean; depositSlip?: boolean; bankAccount?: boolean };
  cta: string;
}

const OVERRIDE_ROLES = ["admin", "managing_officer"];

export const CUSTODY_STAGES: Record<CustodyStage, CustodyStageDef> = {
  cashier_count: {
    key: "cashier_count",
    label: "Cashier count",
    actorRoles: ["hotel_cashier"],
    blurb: "Hotel/rental cashier counts the cash and submits the transmittal.",
    needs: { counted: true },
    cta: "Record cashier count",
  },
  monitoring_recount: {
    key: "monitoring_recount",
    label: "Monitoring recount",
    actorRoles: ["hotel_rental_monitoring"],
    blurb: "Hotel/rental monitoring recounts, records, and transmits to the liaison.",
    needs: { counted: true },
    cta: "Confirm recount & transmit",
  },
  passbook_issued: {
    key: "passbook_issued",
    label: "Passbook issued",
    actorRoles: ["accounting"],
    blurb: "Accounting issues the bank passbook for the deposit.",
    needs: { passbook: true },
    cta: "Issue passbook",
  },
  liaison_count: {
    key: "liaison_count",
    label: "Liaison count & deposit slip",
    actorRoles: ["errand_liaison"],
    blurb: "Errand/liaison counts the cash received and prepares the deposit slip.",
    needs: { counted: true, depositSlip: true, bankAccount: true },
    cta: "Record count & deposit slip",
  },
  deposited: {
    key: "deposited",
    label: "Deposited",
    actorRoles: ["errand_liaison"],
    blurb: "Errand/liaison deposits the cash to the bank account.",
    needs: { counted: true, bankAccount: true },
    cta: "Mark deposited",
  },
};

/** The stage that comes after `current` (null if the chain is complete). */
export function nextStage(current: CustodyStage): CustodyStage | null {
  const i = CUSTODY_ORDER.indexOf(current);
  return i >= 0 && i < CUSTODY_ORDER.length - 1 ? CUSTODY_ORDER[i + 1] : null;
}

/** Whether the given roles may perform `stage`. */
export function canActOnStage(roleKeys: readonly string[], stage: CustodyStage): boolean {
  const allowed = new Set([...CUSTODY_STAGES[stage].actorRoles, ...OVERRIDE_ROLES]);
  return roleKeys.some((r) => allowed.has(r));
}
