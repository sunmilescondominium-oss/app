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
