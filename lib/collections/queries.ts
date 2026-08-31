import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { roomCharge, round2 } from "@/lib/hotel/rates";
import type {
  Collection,
  StayBilling,
  Transmittal,
  TransmittalDetail,
  UnitOption,
} from "./types";
import type { CustodyStage } from "./custody";

export interface CustodyEvent {
  id: string;
  stage: CustodyStage;
  actor_role: string | null;
  counted_amount: number | null;
  expected_amount: number | null;
  variance: number | null;
  passbook_ref: string | null;
  deposit_slip_ref: string | null;
  bank_account_label: string | null;
  note: string | null;
  created_at: string;
}

/** Chain-of-custody events for a transmittal (service role; page-gated). */
export async function listCustody(transmittalId: string): Promise<CustodyEvent[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("transmittal_custody")
    .select("*, bank_accounts(label)")
    .eq("transmittal_id", transmittalId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    stage: r.stage as CustodyStage,
    actor_role: (r.actor_role as string) ?? null,
    counted_amount: r.counted_amount != null ? Number(r.counted_amount) : null,
    expected_amount: r.expected_amount != null ? Number(r.expected_amount) : null,
    variance: r.variance != null ? Number(r.variance) : null,
    passbook_ref: (r.passbook_ref as string) ?? null,
    deposit_slip_ref: (r.deposit_slip_ref as string) ?? null,
    bank_account_label: ((r.bank_accounts as { label?: string } | null)?.label as string) ?? null,
    note: (r.note as string) ?? null,
    created_at: r.created_at as string,
  }));
}

function mapCollection(r: Record<string, unknown>): Collection {
  const u = r.units as
    | { unit_number: string; properties?: { name?: string } | null }
    | null;
  return {
    id: r.id as string,
    business_line: r.business_line as string,
    unit_id: (r.unit_id as string) ?? null,
    charge_type: (r.charge_type as string) ?? null,
    amount: Number(r.amount),
    or_number: (r.or_number as string) ?? null,
    receipt_type: (r.receipt_type as string) ?? null,
    check_number: (r.check_number as string) ?? null,
    check_date: (r.check_date as string) ?? null,
    check_bank: (r.check_bank as string) ?? null,
    cleared_at: (r.cleared_at as string) ?? null,
    cleared_by_role: (r.cleared_by_role as string) ?? null,
    payment_type: r.payment_type as string,
    collected_by_role: (r.collected_by_role as string) ?? null,
    collector_name: (r.collector_name as string) ?? null,
    ar_no: (r.ar_no as string) ?? null,
    collected_on: r.collected_on as string,
    transmittal_id: (r.transmittal_id as string) ?? null,
    remarks: (r.remarks as string) ?? null,
    created_at: r.created_at as string,
    unit: u ? { unit_number: u.unit_number, property_name: u.properties?.name } : null,
  };
}

// Fetch stay billing keyed by unit_id, for hotel collections on a specific date.
// Collections don't carry stay_id, so we join via unit_id + date overlap.
async function fetchStayBillingByUnitDate(
  unitIds: string[],
  date: string, // YYYY-MM-DD Manila date
): Promise<Map<string, StayBilling>> {
  if (!unitIds.length) return new Map();
  const admin = createAdminClient();

  // Use UTC timestamps so the '+' in '+08:00' doesn't misfire as space in query strings
  const startZ = new Date(date + "T00:00:00.000+08:00").toISOString();
  const endZ   = new Date(date + "T23:59:59.999+08:00").toISOString();

  // Stays whose check-in was on or before end-of-day AND are either still
  // active OR checked out on or after start-of-day (covers same-day stays
  // and overnight stays that checked out this day).
  const { data } = await admin
    .from("stays")
    .select(`
      id, unit_id, guest_label, status,
      checked_in_at, checked_out_at,
      planned_hours, base_hours, base_rate, extra_hour_rate,
      extra_persons, extra_person_amount, discount_amount,
      stay_orders(qty, unit_price, menu_item_id)
    `)
    .in("unit_id", unitIds)
    .lte("checked_in_at", endZ)
    .or(`checked_out_at.is.null,checked_out_at.gte.${startZ}`)
    .order("checked_in_at", { ascending: false }); // latest check-in wins per unit

  type RawRow = {
    id: string; unit_id: string; guest_label: string; status: string;
    checked_in_at: string; checked_out_at: string | null;
    planned_hours: number; base_hours: number; base_rate: number;
    extra_hour_rate: number; extra_persons: number | null;
    extra_person_amount: number | null; discount_amount: number | null;
    stay_orders: { qty: number; unit_price: number; menu_item_id: string | null }[];
  };

  const map = new Map<string, StayBilling>();
  for (const s of (data as unknown as RawRow[]) ?? []) {
    if (map.has(s.unit_id)) continue; // already got the most-recent stay for this unit
    const rc = roomCharge(Number(s.base_rate), Number(s.extra_hour_rate), Number(s.base_hours), Number(s.planned_hours));
    const extraPersonTotal = round2(Number(s.extra_person_amount ?? 0));
    const incidentalsTotal = round2(
      (s.stay_orders ?? []).reduce((sum, o) => sum + Number(o.qty) * Number(o.unit_price), 0),
    );
    const discountAmount = round2(Math.min(rc, Number(s.discount_amount ?? 0)));
    const totalCharge = round2(Math.max(0, rc + extraPersonTotal + incidentalsTotal - discountAmount));
    map.set(s.unit_id, {
      stayId: s.id,
      guestLabel: s.guest_label,
      roomCharge: rc,
      extraPersonTotal,
      incidentalsTotal,
      discountAmount,
      totalCharge,
      plannedHours: Number(s.planned_hours),
      checkedInAt: s.checked_in_at,
      checkedOutAt: s.checked_out_at,
    });
  }
  return map;
}

export async function listCollections(date: string): Promise<Collection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .select("*, units(unit_number, properties(name))")
    .eq("collected_on", date)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const collections = (data ?? []).map(mapCollection);

  // Enrich hotel/short-stay rows with full stay billing data (join by unit_id + date)
  const hotelUnitIds = [
    ...new Set(
      collections
        .filter((c) => c.business_line === "hotel" && c.unit_id)
        .map((c) => c.unit_id as string),
    ),
  ];
  const billingMap = await fetchStayBillingByUnitDate(hotelUnitIds, date);
  return collections.map((c) =>
    c.unit_id && billingMap.has(c.unit_id)
      ? { ...c, stayBilling: billingMap.get(c.unit_id) ?? null }
      : c,
  );
}

export interface DeletedCollection {
  id: string;
  business_line: string;
  amount: number;
  or_number: string | null;
  payment_type: string;
  collected_on: string;
  deleted_at: string;
  deleted_by: string | null;
  unit: { unit_number: string; property_name?: string } | null;
}

export async function listDeletedCollections(): Promise<DeletedCollection[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("collections")
    .select("id, business_line, amount, or_number, payment_type, collected_on, deleted_at, deleted_by, units(unit_number, properties(name))")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((r: Record<string, unknown>) => {
    const u = r.units as { unit_number: string; properties?: { name?: string } | null } | null;
    return {
      id: r.id as string,
      business_line: r.business_line as string,
      amount: Number(r.amount),
      or_number: (r.or_number as string) ?? null,
      payment_type: r.payment_type as string,
      collected_on: r.collected_on as string,
      deleted_at: r.deleted_at as string,
      deleted_by: (r.deleted_by as string) ?? null,
      unit: u ? { unit_number: u.unit_number, property_name: u.properties?.name } : null,
    };
  });
}

export interface DeletedTransmittal {
  id: string;
  transmittal_date: string;
  total_amount: number;
  status: string;
  deleted_at: string;
  deleted_by: string | null;
}

export async function listDeletedTransmittals(): Promise<DeletedTransmittal[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("transmittals")
    .select("id, transmittal_date, total_amount, status, deleted_at, deleted_by")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    transmittal_date: r.transmittal_date as string,
    total_amount: Number(r.total_amount),
    status: r.status as string,
    deleted_at: r.deleted_at as string,
    deleted_by: (r.deleted_by as string) ?? null,
  }));
}

export async function listUnitOptions(): Promise<UnitOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("id, unit_number, business_line, properties(name)")
    .eq("is_active", true)
    .order("unit_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((u: Record<string, unknown>) => {
    const prop = u.properties as { name?: string } | null;
    return {
      id: u.id as string,
      label: `${u.unit_number as string}${prop?.name ? ` — ${prop.name}` : ""}`,
      business_line: u.business_line as string,
    };
  });
}

export async function getReceiptSeries(): Promise<{ context: string; prefix: string; next_no: number }[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("receipt_series").select("context, prefix, next_no").order("context", { ascending: true });
  return (data ?? []).map((r) => ({ context: r.context as string, prefix: (r.prefix as string) ?? "AR-", next_no: Number(r.next_no) }));
}

export async function listTransmittals(limit = 60): Promise<Transmittal[]> {
  // Service role: gated at the page by requireModule("transmittals"). Lets the
  // hotel cashier and other transmittal roles see rows regardless of table RLS.
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("transmittals")
    .select("*")
    .is("deleted_at", null)
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
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const d = data as Record<string, unknown>;
  return {
    ...(data as unknown as Transmittal),
    total_amount: Number(d.total_amount),
    counted_cash: d.counted_cash == null ? null : Number(d.counted_cash),
    denomination_counts: (d.denomination_counts as Record<string, number> | null) ?? null,
    deposited_amount: d.deposited_amount == null ? null : Number(d.deposited_amount),
    collections: (cols ?? []).map(mapCollection),
  };
}
