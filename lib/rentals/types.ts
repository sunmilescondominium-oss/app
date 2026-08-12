export interface LeaseInfo {
  id: string;
  tenantLabel: string;
  contact: string | null;
  endAt: string | null;
  rentAmount: number;
  billingCycle: string;
  checkoutRequested?: boolean;
}

export interface DueInfo {
  id: string;
  category: string;
  amount: number;
  dueDate: string;
  status: string;
  overdue: boolean;
  dueSoon: boolean;
}

export interface OccupancyRow {
  unitId: string;
  unitNumber: string;
  propertyName: string;
  businessLine: string;
  unitStatus: string;
  lease: LeaseInfo | null;
  /** Minutes until an active Airbnb checkout (negative = overdue). */
  checkoutInMins: number | null;
  checkoutSoon: boolean;
  needsHousekeeping: boolean;
  nextDue: DueInfo | null;
}

export interface MeterRow {
  id: string;
  unitId: string;
  unitNumber: string;
  utility: string;
  reading: number;
  readOn: string;
  consumption: number | null;
  billAmount: number | null;
  billingPeriod: string | null;
  orNumber: string | null;
  dueDate: string | null;
}

/** One unit row for the utilities overview — latest reading per utility type. */
export interface UtilityUnitRow {
  unitId: string;
  unitNumber: string;
  propertyName: string;
  businessLine: string;
  meralcoCan: string | null;
  waterAccountNo: string | null;
  electric: MeterRow | null;
  water: MeterRow | null;
}

export interface UnitDetail {
  unitId: string;
  unitNumber: string;
  propertyName: string;
  businessLine: string;
  unitStatus: string;
  meralcoCan: string | null;
  waterAccountNo: string | null;
  lease:
    | (LeaseInfo & {
        startDate: string;
        deposit: number;
        notes: string | null;
        email: string | null;
        permanentAddress: string | null;
        emergencyContact: string | null;
        emergencyPhone: string | null;
        motorPlate: string | null;
        leaseType: string | null;
        transferredFrom: string | null;
        portalPin: string | null;
        portalToken: string | null;
        checkoutRequested: boolean;
        extensionRequested: string | null;
      })
    | null;
  needsHousekeeping: boolean;
}

export interface LeaseDoc {
  docType: string;
  submitted: boolean;
  hasFile: boolean;
  id: string | null;
  note: string | null;
}

export interface Reminder {
  kind: "checkout" | "due";
  label: string;
  detail: string;
  tone: "amber" | "red";
}
