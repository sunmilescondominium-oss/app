"use server";

import { requireModule } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { listOccupiedRoomsForGuard } from "@/lib/guard/queries";
import type { GuardRoomCard } from "@/lib/guard/queries";
import { revalidatePath } from "next/cache";

export type { GuardRoomCard };

type Result = { ok: true } | { ok: false; error: string };

export async function fetchGuardRooms(shiftStartedAt?: string): Promise<GuardRoomCard[]> {
  await requireModule("guard");
  return listOccupiedRoomsForGuard(shiftStartedAt);
}

export async function confirmGuestEntry(
  stayId: string,
  entryCount: number,
): Promise<Result> {
  const user = await requireModule("guard");
  if (!stayId || entryCount < 0) return { ok: false, error: "Invalid input." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("stays")
    .update({
      guard_entry_confirmed: true,
      guard_entry_count: entryCount,
      guard_entry_confirmed_at: new Date().toISOString(),
      guard_entry_confirmed_by: user.userId,
    })
    .eq("id", stayId)
    .eq("status", "active");

  if (error) return { ok: false, error: error.message };
  revalidatePath("/guard");
  return { ok: true };
}

export async function acknowledgeTransfer(transferId: string): Promise<Result> {
  const user = await requireModule("guard");
  if (!transferId) return { ok: false, error: "Invalid transfer." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("hotel_room_transfers")
    .update({
      guard_acknowledged: true,
      guard_acknowledged_at: new Date().toISOString(),
      guard_acknowledged_by: user.userId,
    })
    .eq("id", transferId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/guard");
  return { ok: true };
}

export async function reportAdditionalPerson(
  stayId: string,
  count: number,
): Promise<Result> {
  const user = await requireModule("guard");
  if (!stayId || count < 1) return { ok: false, error: "Invalid input." };

  const admin = createAdminClient();

  // Verify stay is still active
  const { data: stay } = await admin
    .from("stays")
    .select("id, status")
    .eq("id", stayId)
    .eq("status", "active")
    .maybeSingle();
  if (!stay) return { ok: false, error: "Stay not found or already checked out." };

  const { error } = await admin.from("hotel_stay_person_events").insert({
    stay_id: stayId,
    event_type: "additional_reported",
    person_count: count,
    reported_by: user.userId,
  });
  if (error) return { ok: false, error: error.message };

  // Also create a guard alert so it's visible to cashier
  await admin.from("hotel_guard_alerts").insert({
    stay_id: stayId,
    alert_type: "additional_person",
    message: `${count} additional person${count > 1 ? "s" : ""} at gate — fee not collected`,
    raised_by: user.userId,
  });

  revalidatePath("/guard");
  return { ok: true };
}

export async function confirmAdditionalEntry(
  personEventId: string,
  count: number,
): Promise<Result> {
  const user = await requireModule("guard");
  if (!personEventId) return { ok: false, error: "Invalid event." };

  const admin = createAdminClient();

  // Verify fee was authorized before guard can confirm
  const { data: ev } = await admin
    .from("hotel_stay_person_events")
    .select("id, stay_id, person_count, fee_collected_at, confirmed_at")
    .eq("id", personEventId)
    .maybeSingle();

  if (!ev) return { ok: false, error: "Event not found." };
  if (!ev.fee_collected_at) {
    return { ok: false, error: "Cashier has not authorized entry yet. Wait for fee collection." };
  }
  if (ev.confirmed_at) return { ok: false, error: "Entry already confirmed." };

  const now = new Date().toISOString();
  const { error } = await admin
    .from("hotel_stay_person_events")
    .update({ confirmed_at: now, confirmed_by: user.userId, event_type: "entry_confirmed" })
    .eq("id", personEventId);
  if (error) return { ok: false, error: error.message };

  // Increment guard entry count on the stay
  const { data: stayRow } = await admin
    .from("stays")
    .select("guard_entry_count, guest_count")
    .eq("id", ev.stay_id as string)
    .maybeSingle();

  const currentCount = Number(stayRow?.guard_entry_count ?? 0);
  const newCount = currentCount + count;
  await admin
    .from("stays")
    .update({ guard_entry_count: newCount, guest_count: Math.max(Number(stayRow?.guest_count ?? 1), newCount) })
    .eq("id", ev.stay_id as string);

  revalidatePath("/guard");
  return { ok: true };
}

export async function confirmGuestExit(stayId: string): Promise<Result> {
  const user = await requireModule("guard");
  if (!stayId) return { ok: false, error: "Invalid stay." };

  const admin = createAdminClient();

  // Stay must be checked_out (gate pass already issued by cashier)
  const { data: stay } = await admin
    .from("stays")
    .select("id, status")
    .eq("id", stayId)
    .maybeSingle();

  if (!stay) return { ok: false, error: "Stay not found." };
  if (stay.status === "active") {
    return {
      ok: false,
      error: "Cashier has not issued a gate pass yet. Wait for cashier to check out this guest.",
    };
  }

  const { error } = await admin
    .from("stays")
    .update({
      guard_exit_confirmed: true,
      guard_exit_confirmed_at: new Date().toISOString(),
      guard_exit_confirmed_by: user.userId,
    })
    .eq("id", stayId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/guard");
  return { ok: true };
}

export async function raiseUnauthorizedEntry(
  stayId: string,
  message: string,
): Promise<Result> {
  const user = await requireModule("guard");
  if (!stayId) return { ok: false, error: "Invalid stay." };

  const admin = createAdminClient();
  const { error } = await admin.from("hotel_guard_alerts").insert({
    stay_id: stayId,
    alert_type: "unauthorized_entry",
    message: message.trim() || null,
    raised_by: user.userId,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/guard");
  return { ok: true };
}
