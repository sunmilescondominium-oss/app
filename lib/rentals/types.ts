export interface LeaseInfo {
  id: string;
  tenantLabel: string;
  contact: string | null;
  endAt: string | null;
  rentAmount: number;
  billingCycle: string;
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
}

export interface Reminder {
  kind: "checkout" | "due";
  label: string;
  detail: string;
  tone: "amber" | "red";
}
