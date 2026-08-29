import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface GuardPost {
  id: string;
  name: string;
  code: string;
}

export interface GuardShift {
  id: string;
  postId: string;
  postName: string;
  postCode: string;
  shiftType: "day" | "night";
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
}

export interface EntranceLogEntry {
  id: string;
  postId: string;
  postName: string;
  entryType: string;
  vehicleType: string | null;
  plateNumber: string | null;
  driverName: string | null;
  passengerCount: number | null;
  notes: string | null;
  timeIn: string;
  timeOut: string | null;
  linkedStayId: string | null;
  createdAt: string;
}

export interface ReferralCheck {
  found: boolean;
  logId: string | null;
  plateNumber: string;
  driverId: string | null;
}

export async function listGuardPosts(): Promise<GuardPost[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guard_posts")
    .select("id, name, code")
    .eq("is_active", true)
    .order("name");
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    code: r.code as string,
  }));
}

export async function getActiveShift(guardId: string): Promise<GuardShift | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("guard_shifts")
    .select("id, post_id, shift_type, started_at, ended_at, notes, guard_posts(name, code)")
    .eq("guard_id", guardId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const post = data.guard_posts as unknown as { name: string; code: string } | null;
  return {
    id: data.id as string,
    postId: data.post_id as string,
    postName: post?.name ?? "",
    postCode: post?.code ?? "",
    shiftType: data.shift_type as "day" | "night",
    startedAt: data.started_at as string,
    endedAt: (data.ended_at as string | null) ?? null,
    notes: (data.notes as string | null) ?? null,
  };
}

export async function listTodayEntrances(postId: string): Promise<EntranceLogEntry[]> {
  const admin = createAdminClient();
  const manilaToday = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
  );
  manilaToday.setHours(0, 0, 0, 0);
  const { data } = await admin
    .from("guard_entrance_log")
    .select("id, post_id, entry_type, vehicle_type, plate_number, driver_name, passenger_count, notes, time_in, time_out, linked_stay_id, created_at, guard_posts(name)")
    .eq("post_id", postId)
    .gte("time_in", manilaToday.toISOString())
    .order("time_in", { ascending: false })
    .limit(100);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    postId: r.post_id as string,
    postName: ((r.guard_posts as { name?: string } | null)?.name as string | null) ?? "",
    entryType: r.entry_type as string,
    vehicleType: (r.vehicle_type as string | null) ?? null,
    plateNumber: (r.plate_number as string | null) ?? null,
    driverName: (r.driver_name as string | null) ?? null,
    passengerCount: (r.passenger_count as number | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    timeIn: r.time_in as string,
    timeOut: (r.time_out as string | null) ?? null,
    linkedStayId: (r.linked_stay_id as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

/** Check guard entrance log at hotel_gate for a given plate within the referral window. */
export async function checkReferralPlate(
  plateNumber: string,
  windowMinutes: number,
): Promise<ReferralCheck> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  // Must be hotel_gate post
  const { data: post } = await admin
    .from("guard_posts")
    .select("id")
    .eq("code", "hotel_gate")
    .maybeSingle();
  if (!post) return { found: false, logId: null, plateNumber, driverId: null };

  const normalized = plateNumber.trim().toUpperCase().replace(/\s+/g, " ");
  const { data } = await admin
    .from("guard_entrance_log")
    .select("id, linked_stay_id")
    .eq("post_id", post.id as string)
    .ilike("plate_number", normalized)
    .gte("time_in", since)
    .is("linked_stay_id", null) // not yet claimed by another stay
    .order("time_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return { found: false, logId: null, plateNumber, driverId: null };

  // Check registered driver
  const { data: driver } = await admin
    .from("referral_drivers")
    .select("id")
    .ilike("plate_number", normalized)
    .eq("status", "active")
    .maybeSingle();

  return {
    found: true,
    logId: data.id as string,
    plateNumber: normalized,
    driverId: driver ? (driver.id as string) : null,
  };
}

/** Verify a discount coupon number was recorded by a guard at hotel_gate within the window. */
export async function checkCouponNo(couponNo: string, windowMinutes: number): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { data: post } = await admin.from("guard_posts").select("id").eq("code", "hotel_gate").maybeSingle();
  if (!post) return false;
  const normalized = couponNo.trim().toUpperCase();
  const { data } = await admin
    .from("guard_entrance_log")
    .select("id")
    .eq("post_id", post.id as string)
    .ilike("discount_coupon_no", normalized)
    .gte("time_in", since)
    .limit(1)
    .maybeSingle();
  return !!data;
}

/** Get referral record for a stay. */
export async function getStayReferral(stayId: string): Promise<{
  plateNumber: string;
  referralAmount: number;
  verified: boolean;
} | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("stay_referrals")
    .select("plate_number, referral_amount, verified")
    .eq("stay_id", stayId)
    .maybeSingle();
  if (!data) return null;
  return {
    plateNumber: data.plate_number as string,
    referralAmount: Number(data.referral_amount),
    verified: Boolean(data.verified),
  };
}
