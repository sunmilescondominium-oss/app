import { createAdminClient } from "@/lib/supabase/admin";

export interface ReferralDriver {
  id: string;
  name: string;
  plateNumber: string;
  vehicleType: string;
  contact: string | null;
  status: "active" | "suspended" | "inactive";
  notes: string | null;
  accreditedAt: string;
}

export interface ReferralRecord {
  id: string;
  stayId: string;
  unitNumber: string;
  guestLabel: string;
  plateNumber: string;
  referralAmount: number;
  verified: boolean;
  driverName: string | null;
  createdAt: string;
}

export async function listReferralDrivers(): Promise<ReferralDriver[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("referral_drivers")
    .select("id, name, plate_number, vehicle_type, contact, status, notes, accredited_at")
    .order("status")
    .order("name");
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    plateNumber: r.plate_number as string,
    vehicleType: r.vehicle_type as string,
    contact: (r.contact as string | null) ?? null,
    status: r.status as "active" | "suspended" | "inactive",
    notes: (r.notes as string | null) ?? null,
    accreditedAt: r.accredited_at as string,
  }));
}

export async function listReferralHistory(limit = 100): Promise<ReferralRecord[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("stay_referrals")
    .select(`
      id, stay_id, plate_number, referral_amount, verified, created_at,
      stays(guest_label, units(unit_number)),
      referral_drivers(name)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => {
    const stay = r.stays as unknown as { guest_label: string; units: { unit_number: string } | { unit_number: string }[] } | null;
    const units = stay?.units;
    const unit = Array.isArray(units) ? units[0] : units;
    const driver = r.referral_drivers as unknown as { name: string } | null;
    return {
      id: r.id as string,
      stayId: r.stay_id as string,
      unitNumber: unit?.unit_number ?? "?",
      guestLabel: stay?.guest_label ?? "—",
      plateNumber: r.plate_number as string,
      referralAmount: Number(r.referral_amount),
      verified: Boolean(r.verified),
      driverName: driver?.name ?? null,
      createdAt: r.created_at as string,
    };
  });
}
