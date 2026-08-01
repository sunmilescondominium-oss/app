import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  UNIT_STATUSES,
  BUSINESS_LINES,
  type UnitStatus,
  type BusinessLineKey,
} from "@/lib/config";
import type {
  Property,
  Unit,
  UnitFilters,
  InventorySummary,
  FieldDefinition,
} from "./types";

export async function listProperties(includeInactive = false): Promise<Property[]> {
  const supabase = await createClient();
  let q = supabase.from("properties").select("*").order("name", { ascending: true });
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Property[];
}

export async function listUnits(filters: UnitFilters = {}): Promise<Unit[]> {
  const supabase = await createClient();
  let q = supabase.from("units").select("*, properties(name)");

  if (!filters.includeInactive) q = q.eq("is_active", true);
  if (filters.businessLines && filters.businessLines.length)
    q = q.in("business_line", filters.businessLines);
  if (filters.businessLine) q = q.eq("business_line", filters.businessLine);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.propertyId) q = q.eq("property_id", filters.propertyId);

  q = q.order("property_id", { ascending: true }).order("unit_number", {
    ascending: true,
  });

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r: Record<string, unknown>) => {
    const { properties, ...rest } = r as {
      properties?: { name: string } | null;
    } & Record<string, unknown>;
    const unit = rest as unknown as Unit;
    return {
      ...unit,
      custom_fields:
        (rest.custom_fields as Record<string, unknown> | null) ?? {},
      property: properties ?? null,
    };
  });
}

export async function listFieldDefinitions(): Promise<FieldDefinition[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("unit_field_definitions")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((d: Record<string, unknown>) => ({
    ...(d as unknown as FieldDefinition),
    options: Array.isArray(d.options) ? (d.options as string[]) : [],
  }));
}

export async function inventorySummary(
  allowedLines?: string[],
): Promise<InventorySummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("status, business_line, is_active");
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as {
    status: UnitStatus;
    business_line: BusinessLineKey;
    is_active: boolean;
  }[]).filter((r) => !allowedLines || allowedLines.includes(r.business_line));

  const byStatus = Object.fromEntries(
    UNIT_STATUSES.map((s) => [s, 0]),
  ) as Record<UnitStatus, number>;
  const byBusinessLine = Object.fromEntries(
    BUSINESS_LINES.map((b) => [b.key, 0]),
  ) as Record<BusinessLineKey, number>;

  let total = 0;
  let inactive = 0;
  for (const r of rows) {
    if (!r.is_active) {
      inactive++;
      continue;
    }
    total++;
    if (r.status in byStatus) byStatus[r.status]++;
    if (r.business_line in byBusinessLine) byBusinessLine[r.business_line]++;
  }

  return { total, inactive, byStatus, byBusinessLine };
}
