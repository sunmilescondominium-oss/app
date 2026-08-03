import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayManila } from "@/lib/collections/summary";

export interface DashboardData {
  collectionsToday: number;
  txPending: number;
  hotel: { occupied: number; vacant: number; forHousekeeping: number };
  rentals: { occupied: number; vacant: number; duesFlagged: number };
  housekeepingOpen: number;
  attendance: { checkedIn: number; checkedOut: number };
  pendingRequests: number;
  repairsOpen: number;
}

/** One cheap pass of headline numbers; the page shows only role-relevant cards. */
export async function getDashboard(): Promise<DashboardData> {
  const admin = createAdminClient();
  const today = todayManila();

  const [
    { data: colsToday },
    { count: txPending },
    { data: hotelUnits },
    { data: activeStays },
    { data: openHk },
    { data: rentalUnits },
    { data: rentalLeases },
    { data: rentalDues },
    { data: recToday },
    { count: pendingRequests },
    { count: repairsOpen },
  ] = await Promise.all([
    admin.from("collections").select("amount").eq("collected_on", today),
    admin.from("transmittals").select("id", { count: "exact", head: true }).in("status", ["submitted", "deposited"]),
    admin.from("units").select("id").eq("business_line", "hotel").eq("is_active", true),
    admin.from("stays").select("unit_id").eq("status", "active"),
    admin.from("housekeeping_tasks").select("unit_id, status").in("status", ["pending", "in_progress"]),
    admin.from("units").select("id").in("business_line", ["rental", "airbnb"]).eq("is_active", true),
    admin.from("leases").select("unit_id").eq("status", "active"),
    admin.from("rental_dues").select("due_date").eq("status", "unpaid"),
    admin.from("time_records").select("time_out").eq("work_date", today),
    admin.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("repair_requests").select("id", { count: "exact", head: true }).neq("status", "completed"),
  ]);

  const collectionsToday = (colsToday ?? []).reduce((s, c) => s + Number(c.amount), 0);

  const occupiedHotel = new Set((activeStays ?? []).map((s) => s.unit_id as string));
  const dirty = new Set((openHk ?? []).map((t) => t.unit_id as string).filter(Boolean));
  const hotelIds = (hotelUnits ?? []).map((u) => u.id as string);
  const hotel = {
    occupied: hotelIds.filter((id) => occupiedHotel.has(id)).length,
    forHousekeeping: hotelIds.filter((id) => !occupiedHotel.has(id) && dirty.has(id)).length,
    vacant: hotelIds.filter((id) => !occupiedHotel.has(id) && !dirty.has(id)).length,
  };

  const occupiedRental = new Set((rentalLeases ?? []).map((l) => l.unit_id as string));
  const rentalIds = (rentalUnits ?? []).map((u) => u.id as string);
  const duesFlagged = (rentalDues ?? []).filter((d) => {
    const days = Math.round((new Date(d.due_date as string).getTime() - new Date(today).getTime()) / 86_400_000);
    return days <= 3;
  }).length;
  const rentals = {
    occupied: rentalIds.filter((id) => occupiedRental.has(id)).length,
    vacant: rentalIds.filter((id) => !occupiedRental.has(id)).length,
    duesFlagged,
  };

  const attendance = {
    checkedIn: (recToday ?? []).filter((r) => r.time_out == null).length,
    checkedOut: (recToday ?? []).filter((r) => r.time_out != null).length,
  };

  return {
    collectionsToday,
    txPending: txPending ?? 0,
    hotel,
    rentals,
    housekeepingOpen: (openHk ?? []).length,
    attendance,
    pendingRequests: pendingRequests ?? 0,
    repairsOpen: repairsOpen ?? 0,
  };
}
