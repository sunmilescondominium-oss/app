import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ShiftHandover {
  id: string;
  shift_date: string;
  cashier_user_id: string | null;
  cashier_role: string;
  cashier_name: string | null;
  counted_amount: number | null;
  denomination_counts: Record<string, number> | null;
  remarks: string | null;
  cashier_absent: boolean;
  handed_over_at: string;
}

export interface HotelShiftCollection {
  id: string;
  or_number: string | null;
  amount: number;
  payment_type: string;
  charge_type: string | null;
  unit_number: string | null;
  collected_on: string;
}

function mapHandover(r: Record<string, unknown>): ShiftHandover {
  return {
    id: r.id as string,
    shift_date: r.shift_date as string,
    cashier_user_id: (r.cashier_user_id as string) ?? null,
    cashier_role: r.cashier_role as string,
    cashier_name: null,
    counted_amount: r.counted_amount != null ? Number(r.counted_amount) : null,
    denomination_counts: r.denomination_counts
      ? (r.denomination_counts as Record<string, number>)
      : null,
    remarks: (r.remarks as string) ?? null,
    cashier_absent: Boolean(r.cashier_absent),
    handed_over_at: r.handed_over_at as string,
  };
}

async function resolveCashierNames(
  admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  handovers: ShiftHandover[],
): Promise<void> {
  const userIds = [...new Set(handovers.map((h) => h.cashier_user_id).filter(Boolean) as string[])];
  if (userIds.length === 0) return;
  const { data } = await admin.from("profiles").select("id, full_name").in("id", userIds);
  const nameMap = Object.fromEntries(
    (data ?? []).map((p: Record<string, unknown>) => [p.id as string, p.full_name as string | null]),
  );
  for (const h of handovers) {
    if (h.cashier_user_id) h.cashier_name = nameMap[h.cashier_user_id] ?? null;
  }
}

/** Get the handover record for a specific shift date (null if not yet submitted). */
export async function getShiftHandover(date: string): Promise<ShiftHandover | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hotel_shift_handovers")
    .select("*")
    .eq("shift_date", date)
    .maybeSingle();
  if (!data) return null;
  const handover = mapHandover(data as Record<string, unknown>);
  await resolveCashierNames(admin, [handover]);
  return handover;
}

/** List recent handovers (last 14 days) for the monitoring queue. */
export async function listRecentHandovers(limit = 14): Promise<ShiftHandover[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hotel_shift_handovers")
    .select("*")
    .order("shift_date", { ascending: false })
    .limit(limit);
  const handovers = (data ?? []).map((r) => mapHandover(r as Record<string, unknown>));
  await resolveCashierNames(admin, handovers);
  return handovers;
}

/** Return the hotel-shift transmittal id for a given handover, or null if not yet built. */
export async function getHotelShiftTransmittalId(handoverId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("transmittals")
    .select("id")
    .eq("handover_id", handoverId)
    .eq("is_hotel_shift", true)
    .maybeSingle();
  return data ? (data as { id: string }).id : null;
}

/** Hotel collections (business_line=hotel) for a specific date that are not yet transmitted. */
export async function listHotelCollectionsForDate(date: string): Promise<HotelShiftCollection[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("collections")
    .select("id, or_number, amount, payment_type, charge_type, collected_on, units(unit_number)")
    .eq("business_line", "hotel")
    .eq("collected_on", date)
    .is("transmittal_id", null)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    or_number: (r.or_number as string) ?? null,
    amount: Number(r.amount),
    payment_type: r.payment_type as string,
    charge_type: (r.charge_type as string) ?? null,
    unit_number: (r.units as { unit_number?: string } | null)?.unit_number ?? null,
    collected_on: r.collected_on as string,
  }));
}
