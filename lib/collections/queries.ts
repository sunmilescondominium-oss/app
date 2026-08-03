import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Collection,
  Transmittal,
  TransmittalDetail,
  UnitOption,
} from "./types";

function mapCollection(r: Record<string, unknown>): Collection {
  const u = r.units as
    | { unit_number: string; properties?: { name?: string } | null }
    | null;
  return {
    id: r.id as string,
    business_line: r.business_line as string,
    unit_id: (r.unit_id as string) ?? null,
    amount: Number(r.amount),
    or_number: (r.or_number as string) ?? null,
    payment_type: r.payment_type as string,
    collected_by_role: (r.collected_by_role as string) ?? null,
    collected_on: r.collected_on as string,
    transmittal_id: (r.transmittal_id as string) ?? null,
    remarks: (r.remarks as string) ?? null,
    created_at: r.created_at as string,
    unit: u ? { unit_number: u.unit_number, property_name: u.properties?.name } : null,
  };
}

export async function listCollections(date: string): Promise<Collection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .select("*, units(unit_number, properties(name))")
    .eq("collected_on", date)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCollection);
}

export async function listUnitOptions(): Promise<UnitOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("id, unit_number, properties(name)")
    .eq("is_active", true)
    .order("unit_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((u: Record<string, unknown>) => {
    const prop = u.properties as { name?: string } | null;
    return {
      id: u.id as string,
      label: `${u.unit_number as string}${prop?.name ? ` — ${prop.name}` : ""}`,
    };
  });
}

export async function listTransmittals(limit = 60): Promise<Transmittal[]> {
  // Service role: gated at the page by requireModule("transmittals"). Lets the
  // hotel cashier and other transmittal roles see rows regardless of table RLS.
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("transmittals")
    .select("*")
    .order("transmittal_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((t: Record<string, unknown>) => ({
    ...(t as unknown as Transmittal),
    total_amount: Number(t.total_amount),
  }));
}

export async function getTransmittal(id: string): Promise<TransmittalDetail | null> {
  // Service role (gated by requireModule("transmittals")) so the bundled
  // collection line items are visible to every transmittal role.
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("transmittals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: cols } = await supabase
    .from("collections")
    .select("*, units(unit_number, properties(name))")
    .eq("transmittal_id", id)
    .order("created_at", { ascending: true });

  const d = data as Record<string, unknown>;
  return {
    ...(data as unknown as Transmittal),
    total_amount: Number(d.total_amount),
    counted_cash: d.counted_cash == null ? null : Number(d.counted_cash),
    denomination_counts: (d.denomination_counts as Record<string, number> | null) ?? null,
    collections: (cols ?? []).map(mapCollection),
  };
}
