import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AirbnbGuest {
  token: string;
  unitNumber: string;
  propertyName: string;
  guest: string;
  status: string;
  startDate: string;
  endAt: string | null;
  rate: number;
  billingCycle: string;
  amenities: string[];
  extraCharges: { label: string; amount: number; dueDate: string }[];
  extraTotal: number;
  total: number;
  balance: number;
  checkoutRequested: boolean;
  extensionRequested: string | null;
}

const AMENITY_LABELS: Record<string, string> = {
  ref: "Refrigerator",
  refrigerator: "Refrigerator",
  kitchen: "Kitchen",
  dining: "Dining area",
  aircon: "Air-conditioning",
  tv: "TV",
  internet: "Wi-Fi / Internet",
  wifi: "Wi-Fi / Internet",
  toilet: "Toilet & bath",
};

function amenityList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((k) => AMENITY_LABELS[String(k)] ?? String(k));
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => AMENITY_LABELS[k] ?? k);
  }
  return [];
}

export async function getAirbnbGuest(token: string): Promise<AirbnbGuest | null> {
  const admin = createAdminClient();
  const { data: l } = await admin
    .from("leases")
    .select("id, unit_id, tenant_label, status, start_date, end_at, rent_amount, billing_cycle, checkout_requested, extension_requested, business_line, units(unit_number, amenities, properties(name))")
    .eq("portal_token", token)
    .maybeSingle();
  if (!l || l.business_line !== "airbnb") return null;

  const { data: dues } = await admin
    .from("rental_dues")
    .select("category, amount, due_date, status, remarks")
    .eq("unit_id", l.unit_id)
    .eq("status", "unpaid")
    .order("due_date", { ascending: true });

  const extraCharges = (dues ?? []).map((d) => ({
    label: d.remarks ? `${d.category} — ${d.remarks}` : (d.category as string),
    amount: Number(d.amount),
    dueDate: d.due_date as string,
  }));
  const extraTotal = Math.round(extraCharges.reduce((s, c) => s + c.amount, 0) * 100) / 100;
  const rate = Number(l.rent_amount);
  const unit = l.units as { unit_number?: string; amenities?: unknown; properties?: { name?: string } } | null;

  return {
    token,
    unitNumber: (unit?.unit_number as string) ?? "—",
    propertyName: (unit?.properties?.name as string) ?? "—",
    guest: l.tenant_label as string,
    status: l.status as string,
    startDate: l.start_date as string,
    endAt: (l.end_at as string | null) ?? null,
    rate,
    billingCycle: l.billing_cycle as string,
    amenities: amenityList(unit?.amenities),
    extraCharges,
    extraTotal,
    total: Math.round((rate + extraTotal) * 100) / 100,
    balance: extraTotal, // the booking rate is paid in advance
    checkoutRequested: Boolean(l.checkout_requested),
    extensionRequested: (l.extension_requested as string | null) ?? null,
  };
}
