import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ShiftHandover {
  id: string;
  shift_date: string;
  cashier_user_id: string | null;
  cashier_role: string;
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
  unit_number: string | null;
  collected_on: string;
}

function mapHandover(r: Record<string, unknown>): ShiftHandover {
  return {
    id: r.id as string,
    shift_date: r.shift_date as string,
    cashier_user_id: (r.cashier_user_id as string) ?? null,
    cashier_role: r.cashier_role as string,
    counted_amount: r.counted_amount != null ? Number(r.counted_amount) : null,
    denomination_counts: r.denomination_counts
      ? (r.denomination_counts as Record<string, number>)
      : null,
    remarks: (r.remarks as string) ?? null,
    cashier_absent: Boolean(r.cashier_absent),
    handed_over_at: r.handed_over_at as string,
  };
}

/** Get the handover record for a specific shift date (null if not yet submitted). */
export async function getShiftHandover(date: string): Promise<ShiftHandover | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hotel_shift_handovers")
    .select("*")
    .eq("shift_date", date)
    .maybeSingle();
  return data ? mapHandover(data as Record<string, unknown>) : null;
}

/** List recent handovers (last 14 days) for the monitoring queue. */
export async function listRecentHandovers(limit = 14): Promise<ShiftHandover[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("hotel_shift_handovers")
    .select("*")
    .order("shift_date", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => mapHandover(r as Record<string, unknown>));
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
    .select("id, or_number, amount, payment_type, collected_on, units(unit_number)")
    .eq("business_line", "hotel")
    .eq("collected_on", date)
    .is("transmittal_id", null)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    or_number: (r.or_number as string) ?? null,
    amount: Number(r.amount),
    payment_type: r.payment_type as string,
    unit_number: (r.units as { unit_number?: string } | null)?.unit_number ?? null,
    collected_on: r.collected_on as string,
  }));
}
