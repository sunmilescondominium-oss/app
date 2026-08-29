"use server";

import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MANAGE_ROLES = ["admin", "managing_officer", "hotel_rental_monitoring", "consultant"] as const;

async function requireManage() {
  const user = await requireModule("guard");
  if (!userHasAnyRole(user, [...MANAGE_ROLES]))
    throw new Error("Not authorised to manage referral drivers.");
  return user;
}

export async function createReferralDriver(fields: {
  name: string;
  plateNumber: string;
  vehicleType: string;
  contact: string;
  notes: string;
}): Promise<ActionResult> {
  await requireManage();
  const plate = fields.plateNumber.trim().toUpperCase().replace(/\s+/g, " ");
  if (!fields.name.trim()) return { ok: false, error: "Name is required." };
  if (!plate) return { ok: false, error: "Plate number is required." };

  const admin = createAdminClient();
  const { error } = await admin.from("referral_drivers").insert({
    name: fields.name.trim(),
    plate_number: plate,
    vehicle_type: fields.vehicleType || "tricycle",
    contact: fields.contact.trim() || null,
    notes: fields.notes.trim() || null,
    status: "active",
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "A driver with that plate number already exists." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/guard/referrals");
  return { ok: true };
}

export async function updateReferralDriver(
  id: string,
  fields: {
    name: string;
    plateNumber: string;
    vehicleType: string;
    contact: string;
    notes: string;
  },
): Promise<ActionResult> {
  await requireManage();
  const plate = fields.plateNumber.trim().toUpperCase().replace(/\s+/g, " ");
  if (!fields.name.trim()) return { ok: false, error: "Name is required." };
  if (!plate) return { ok: false, error: "Plate number is required." };

  const admin = createAdminClient();
  const { error } = await admin.from("referral_drivers").update({
    name: fields.name.trim(),
    plate_number: plate,
    vehicle_type: fields.vehicleType || "tricycle",
    contact: fields.contact.trim() || null,
    notes: fields.notes.trim() || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Another driver already has that plate number." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/guard/referrals");
  return { ok: true };
}

export async function setDriverStatus(
  id: string,
  status: "active" | "suspended" | "inactive",
): Promise<ActionResult> {
  await requireManage();
  const admin = createAdminClient();
  const { error } = await admin
    .from("referral_drivers")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/guard/referrals");
  return { ok: true };
}

export async function verifyReferral(referralId: string): Promise<ActionResult> {
  await requireManage();
  const admin = createAdminClient();
  const { error } = await admin
    .from("stay_referrals")
    .update({ verified: true })
    .eq("id", referralId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/guard/referrals");
  return { ok: true };
}
