import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AirbnbRatePlan {
  id: string; name: string; rateType: string; rate: number;
  minNights: number; description: string | null; isActive: boolean; sortOrder: number;
}
export interface AirbnbExtra {
  id: string; name: string; category: string; unitPrice: number;
  isActive: boolean; sortOrder: number;
}
export interface AirbnbTaxSettings { taxMode: string; taxRate: number; }
export interface AirbnbOrder {
  id: string; leaseId: string; placedByGuest: boolean;
  status: string; notes: string | null; total: number; createdAt: string;
  items: { id: string; name: string; qty: number; unitPrice: number; subtotal: number }[];
}
export interface AirbnbRequest {
  id: string; leaseId: string; requestType: string; notes: string | null;
  status: string; placedByGuest: boolean; scheduledAt: string | null;
  cancelledAt: string | null; cancelledByGuest: boolean;
  housekeepingTaskId: string | null; repairRequestId: string | null; createdAt: string;
}
export interface UtilityRate {
  id: string; utility: string; ratePerUnit: number; serviceCharge: number;
  effectiveFrom: string; notes: string | null;
}

export async function listAirbnbRatePlans(): Promise<AirbnbRatePlan[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("airbnb_rate_plans").select("*").order("sort_order").order("created_at");
  return (data ?? []).map((r) => ({
    id: r.id as string, name: r.name as string, rateType: r.rate_type as string,
    rate: Number(r.rate), minNights: r.min_nights as number,
    description: (r.description as string | null) ?? null,
    isActive: r.is_active as boolean, sortOrder: r.sort_order as number,
  }));
}

export async function listAirbnbExtras(activeOnly = false): Promise<AirbnbExtra[]> {
  const admin = createAdminClient();
  let q = admin.from("airbnb_extras").select("*").order("category").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return (data ?? []).map((r) => ({
    id: r.id as string, name: r.name as string, category: r.category as string,
    unitPrice: Number(r.unit_price), isActive: r.is_active as boolean, sortOrder: r.sort_order as number,
  }));
}

export async function getAirbnbTaxSettings(): Promise<AirbnbTaxSettings> {
  const admin = createAdminClient();
  const { data } = await admin.from("airbnb_tax_settings").select("*").eq("id", 1).maybeSingle();
  return { taxMode: (data?.tax_mode as string) ?? "none", taxRate: Number(data?.tax_rate ?? 0) };
}

export async function getRentalTaxSettings(): Promise<AirbnbTaxSettings> {
  const admin = createAdminClient();
  const { data } = await admin.from("rental_tax_settings").select("*").eq("id", 1).maybeSingle();
  return { taxMode: (data?.tax_mode as string) ?? "none", taxRate: Number(data?.tax_rate ?? 0) };
}

export async function listUtilityRates(): Promise<UtilityRate[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("utility_rates").select("*").order("utility").order("effective_from", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string, utility: r.utility as string,
    ratePerUnit: Number(r.rate_per_unit), serviceCharge: Number(r.service_charge),
    effectiveFrom: r.effective_from as string, notes: (r.notes as string | null) ?? null,
  }));
}

export async function listAirbnbOrders(leaseId: string): Promise<AirbnbOrder[]> {
  const admin = createAdminClient();
  const { data: orders } = await admin
    .from("airbnb_orders")
    .select("*, airbnb_order_items(*)")
    .eq("lease_id", leaseId)
    .order("created_at", { ascending: false });
  return (orders ?? []).map((o) => ({
    id: o.id as string, leaseId: o.lease_id as string,
    placedByGuest: o.placed_by_guest as boolean,
    status: o.status as string, notes: (o.notes as string | null) ?? null,
    total: Number(o.total), createdAt: o.created_at as string,
    items: ((o.airbnb_order_items as Record<string, unknown>[]) ?? []).map((i) => ({
      id: i.id as string, name: i.name as string,
      qty: i.qty as number, unitPrice: Number(i.unit_price), subtotal: Number(i.subtotal),
    })),
  }));
}

export async function listAirbnbRequests(leaseId: string): Promise<AirbnbRequest[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("airbnb_requests")
    .select("*")
    .eq("lease_id", leaseId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string, leaseId: r.lease_id as string,
    requestType: r.request_type as string, notes: (r.notes as string | null) ?? null,
    status: r.status as string, placedByGuest: r.placed_by_guest as boolean,
    scheduledAt: (r.scheduled_at as string | null) ?? null,
    cancelledAt: (r.cancelled_at as string | null) ?? null,
    cancelledByGuest: r.cancelled_by_guest as boolean,
    housekeepingTaskId: (r.housekeeping_task_id as string | null) ?? null,
    repairRequestId: (r.repair_request_id as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

/** Returns the current (most recent) rate for a utility on or before today. */
export async function getCurrentUtilityRate(utility: "electric" | "water"): Promise<UtilityRate | null> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from("utility_rates")
    .select("*")
    .eq("utility", utility)
    .lte("effective_from", today)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string, utility: data.utility as string,
    ratePerUnit: Number(data.rate_per_unit), serviceCharge: Number(data.service_charge),
    effectiveFrom: data.effective_from as string, notes: (data.notes as string | null) ?? null,
  };
}
