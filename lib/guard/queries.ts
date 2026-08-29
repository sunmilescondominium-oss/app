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

// ---------------------------------------------------------------------------
// Guard Hotel Room Board
// ---------------------------------------------------------------------------

export interface PersonEventCard {
  id: string;
  personCount: number;
  feeAuthorizedAt: string | null;  // cashier clicked "Authorize Gate Entry"
  entryConfirmedAt: string | null; // guard confirmed person entered
}

export interface GuardRoomCard {
  stayId: string;
  unitId: string;
  unitNumber: string;
  guestLabel: string;
  guestCount: number;
  extraPersons: number;
  checkInAt: string;
  plannedHours: number;
  status: string;
  checkOutAt: string | null;
  // Entry confirmation
  guardEntryConfirmed: boolean;
  guardEntryCount: number | null;
  guardEntryConfirmedAt: string | null;
  // Exit confirmation
  guardExitConfirmed: boolean;
  guardExitConfirmedAt: string | null;
  // Room transfer
  transferId: string | null;
  transferFromUnit: string | null;
  transferGuardAcknowledged: boolean;
  transferAt: string | null;
  // Mid-stay additional person events
  pendingPersonEvents: PersonEventCard[];   // waiting for cashier authorization
  readyToEnterEvents: PersonEventCard[];    // cashier authorized, guard must confirm
  // Carryover flag
  fromPreviousShift: boolean;
}

export async function listOccupiedRoomsForGuard(
  shiftStartedAt?: string,
): Promise<GuardRoomCard[]> {
  const admin = createAdminClient();

  const { data: stays } = await admin
    .from("stays")
    .select(
      `id, unit_id, guest_label, planned_hours, check_in_at, check_out_at, status,
       guest_count, extra_persons,
       guard_entry_confirmed, guard_entry_count, guard_entry_confirmed_at,
       guard_exit_confirmed, guard_exit_confirmed_at,
       units!inner(unit_number, business_line)`,
    )
    .in("status", ["active", "checked_out"])
    .order("check_in_at", { ascending: true });

  if (!stays || stays.length === 0) return [];

  // Only hotel rooms; for checked_out stays only show if guard hasn't confirmed exit yet
  const hotelStays = stays.filter((s) => {
    const unitRaw = s.units as unknown;
    const unit = (Array.isArray(unitRaw) ? unitRaw[0] : unitRaw) as { unit_number: string; business_line: string } | null;
    if (!unit || unit.business_line !== "hotel") return false;
    if (s.status === "checked_out" && Boolean(s.guard_exit_confirmed)) return false;
    return true;
  });

  if (hotelStays.length === 0) return [];

  const stayIds = hotelStays.map((s) => s.id as string);

  // Get inbound transfers for these stays
  const { data: transfers } = await admin
    .from("hotel_room_transfers")
    .select("id, to_stay_id, from_unit_id, guard_acknowledged, guard_acknowledged_at, transferred_at")
    .in("to_stay_id", stayIds)
    .order("transferred_at", { ascending: false });

  // Resolve from_unit_number for each unique from_unit_id
  const fromUnitIds = [...new Set((transfers ?? []).map((t) => t.from_unit_id as string))];
  const fromUnitMap: Record<string, string> = {};
  if (fromUnitIds.length > 0) {
    const { data: fromUnits } = await admin
      .from("units")
      .select("id, unit_number")
      .in("id", fromUnitIds);
    for (const u of fromUnits ?? []) {
      fromUnitMap[u.id as string] = u.unit_number as string;
    }
  }

  type TransferRow = {
    id: string;
    to_stay_id: string;
    from_unit_id: string;
    guard_acknowledged: boolean;
    guard_acknowledged_at: string | null;
    transferred_at: string;
  };

  // Most-recent inbound transfer per stay
  const transferMap: Record<string, TransferRow> = {};
  for (const t of (transfers ?? []) as TransferRow[]) {
    const sid = t.to_stay_id;
    if (!transferMap[sid]) transferMap[sid] = t;
  }

  // Fetch open (not entry-confirmed) person events for these stays
  const { data: personEventsRaw } = await admin
    .from("hotel_stay_person_events")
    .select("id, stay_id, person_count, fee_collected_at, confirmed_at")
    .in("stay_id", stayIds)
    .is("confirmed_at", null)        // only events not yet confirmed by guard
    .order("created_at", { ascending: true });

  type PersonEventRow = {
    id: string;
    stay_id: string;
    person_count: number;
    fee_collected_at: string | null;
    confirmed_at: string | null;
  };
  const personEventsAll = (personEventsRaw ?? []) as PersonEventRow[];

  // Group by stay_id
  const personEventsByStay: Record<string, PersonEventRow[]> = {};
  for (const ev of personEventsAll) {
    if (!personEventsByStay[ev.stay_id]) personEventsByStay[ev.stay_id] = [];
    personEventsByStay[ev.stay_id].push(ev);
  }

  return hotelStays.map((s) => {
    const unitRaw = s.units as unknown;
    const unit = (Array.isArray(unitRaw) ? unitRaw[0] : unitRaw) as { unit_number: string } | null;
    const t = transferMap[s.id as string];
    const checkInAt = s.check_in_at as string;
    const stayEvents = personEventsByStay[s.id as string] ?? [];

    const pendingPersonEvents: PersonEventCard[] = stayEvents
      .filter((ev) => !ev.fee_collected_at)
      .map((ev) => ({ id: ev.id, personCount: ev.person_count, feeAuthorizedAt: null, entryConfirmedAt: null }));

    const readyToEnterEvents: PersonEventCard[] = stayEvents
      .filter((ev) => !!ev.fee_collected_at)
      .map((ev) => ({ id: ev.id, personCount: ev.person_count, feeAuthorizedAt: ev.fee_collected_at, entryConfirmedAt: ev.confirmed_at }));

    return {
      stayId: s.id as string,
      unitId: s.unit_id as string,
      unitNumber: unit?.unit_number ?? "?",
      guestLabel: s.guest_label as string,
      guestCount: Number(s.guest_count ?? 1),
      extraPersons: Number(s.extra_persons ?? 0),
      checkInAt,
      plannedHours: Number(s.planned_hours),
      status: s.status as string,
      checkOutAt: (s.check_out_at as string | null) ?? null,
      guardEntryConfirmed: Boolean(s.guard_entry_confirmed),
      guardEntryCount: (s.guard_entry_count as number | null) ?? null,
      guardEntryConfirmedAt: (s.guard_entry_confirmed_at as string | null) ?? null,
      guardExitConfirmed: Boolean(s.guard_exit_confirmed),
      guardExitConfirmedAt: (s.guard_exit_confirmed_at as string | null) ?? null,
      transferId: t ? (t.id as string) : null,
      transferFromUnit: t ? (fromUnitMap[t.from_unit_id as string] ?? null) : null,
      transferGuardAcknowledged: t ? Boolean(t.guard_acknowledged) : true,
      transferAt: t ? (t.transferred_at as string) : null,
      pendingPersonEvents,
      readyToEnterEvents,
      fromPreviousShift: shiftStartedAt
        ? new Date(checkInAt) < new Date(shiftStartedAt)
        : false,
    };
  });
}

// ---------------------------------------------------------------------------
// Guard account management
// ---------------------------------------------------------------------------

export interface GuardAccountRow {
  userId: string;
  displayLabel: string;
  email: string | null;
  guardAgency: string | null;
  guardPosition: string | null;
  guardContractExpiresAt: string | null;
  guardNdaAcknowledgedAt: string | null;
  guardOperation: "hotel" | "condo" | null;
  isExpired: boolean;
}

const GUARD_SELECT = "id, display_label, email, guard_agency, guard_position, guard_contract_expires_at, guard_nda_acknowledged_at, guard_operation";

function mapGuardRow(r: Record<string, unknown>, now: string): GuardAccountRow {
  return {
    userId: r.id as string,
    displayLabel: (r.display_label as string | null) ?? "Guard",
    email: (r.email as string | null) ?? null,
    guardAgency: (r.guard_agency as string | null) ?? null,
    guardPosition: (r.guard_position as string | null) ?? null,
    guardContractExpiresAt: (r.guard_contract_expires_at as string | null) ?? null,
    guardNdaAcknowledgedAt: (r.guard_nda_acknowledged_at as string | null) ?? null,
    guardOperation: (r.guard_operation as "hotel" | "condo" | null) ?? null,
    isExpired: !!(r.guard_contract_expires_at && (r.guard_contract_expires_at as string) < now),
  };
}

export async function listGuardAccounts(): Promise<GuardAccountRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select(GUARD_SELECT)
    .contains("roles", ["guard"])
    .order("display_label");
  const now = new Date().toISOString();
  return (data ?? []).map((r) => mapGuardRow(r as Record<string, unknown>, now));
}

export async function getGuardProfile(userId: string): Promise<GuardAccountRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select(GUARD_SELECT)
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;
  return mapGuardRow(data as Record<string, unknown>, new Date().toISOString());
}

// ---------------------------------------------------------------------------
// Guard handover reports
// ---------------------------------------------------------------------------

export interface HandoverReport {
  id: string;
  outgoingGuardLabel: string;
  postName: string;
  shiftType: "day" | "night";
  incidentsNotes: string | null;
  pendingItems: string | null;
  acknowledgedAt: string | null;
  acknowledgedByLabel: string | null;
  createdAt: string;
}

export async function getLastHandoverForPost(postId: string): Promise<HandoverReport | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("guard_handover_reports")
    .select(`
      id, shift_type, incidents_notes, pending_items, acknowledged_at, created_at,
      outgoing_guard:profiles!guard_handover_reports_outgoing_guard_id_fkey(display_label),
      acknowledged_by_profile:profiles!guard_handover_reports_acknowledged_by_fkey(display_label),
      guard_posts(name)
    `)
    .eq("post_id", postId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    shiftType: data.shift_type as "day" | "night",
    outgoingGuardLabel: ((data.outgoing_guard as { display_label?: string } | null)?.display_label) ?? "Guard",
    postName: ((data.guard_posts as { name?: string } | null)?.name) ?? "",
    incidentsNotes: (data.incidents_notes as string | null) ?? null,
    pendingItems: (data.pending_items as string | null) ?? null,
    acknowledgedAt: (data.acknowledged_at as string | null) ?? null,
    acknowledgedByLabel: ((data.acknowledged_by_profile as { display_label?: string } | null)?.display_label) ?? null,
    createdAt: data.created_at as string,
  };
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
