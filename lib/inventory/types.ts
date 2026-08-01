import type { BusinessLineKey, UnitStatus } from "@/lib/config";

export interface Property {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
}

export interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  unit_type: string | null;
  floor: string | null;
  area_sqm: number | null;
  amenities: Record<string, unknown>;
  status: UnitStatus;
  business_line: BusinessLineKey;
  tcp: number | null;
  is_active: boolean;
  /** Values for admin-defined custom fields, keyed by field definition key. */
  custom_fields: Record<string, unknown>;
  /** Joined for display. */
  property?: { name: string } | null;
}

export type FieldDataType = "text" | "number" | "date" | "select" | "boolean";

/** An admin-defined custom field. Adding one is a row insert — no deploy. */
export interface FieldDefinition {
  id: string;
  business_line: string | null; // null = applies to all lines
  key: string;
  label: string;
  data_type: FieldDataType;
  options: string[];
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface UnitFilters {
  businessLine?: string;
  /** Role-based scope restriction (only these lines are visible). */
  businessLines?: string[];
  status?: string;
  propertyId?: string;
  includeInactive?: boolean;
}

export interface InventorySummary {
  total: number;
  inactive: number;
  byStatus: Record<UnitStatus, number>;
  byBusinessLine: Record<BusinessLineKey, number>;
}

/** One row from a CSV import (all values arrive as strings). */
export interface UnitImportRow {
  property?: string;
  unit_number?: string;
  unit_type?: string;
  floor?: string;
  area_sqm?: string;
  business_line?: string;
  tcp?: string;
  status?: string;
  amenities?: string;
  /** Extra columns matching a custom-field key are captured at runtime. */
  [key: string]: string | undefined;
}

export const CSV_HEADERS = [
  "property",
  "unit_number",
  "unit_type",
  "floor",
  "area_sqm",
  "business_line",
  "tcp",
  "status",
] as const;
