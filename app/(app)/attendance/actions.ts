"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Upload a captured attendance frame to the private bucket; returns its path. */
async function uploadPhoto(userId: string, kind: "in" | "out", photo: FormDataEntryValue | null): Promise<string | null> {
  if (!(photo instanceof File) || photo.size === 0) return null;
  if (photo.size > 8 * 1024 * 1024) return null; // silently skip oversized frame
  const path = `${userId}/${new Date().toISOString().slice(0, 10)}/${kind}-${Date.now()}.jpg`;
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const up = await createAdminClient()
    .storage.from("attendance-photos")
    .upload(path, bytes, { contentType: photo.type || "image/jpeg" });
  return up.error ? null : path;
}

/** Clock IN — one open record per user at a time. */
export async function clockIn(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModule("attendance");
  const supabase = await createClient();

  const { data: open } = await supabase
    .from("time_records")
    .select("id")
    .eq("user_id", user.userId)
    .is("time_out", null)
    .maybeSingle();
  if (open) return { ok: false, error: "You are already clocked in. Clock out first." };

  const photo_path = await uploadPhoto(user.userId, "in", formData.get("photo"));

  const { data, error } = await supabase
    .from("time_records")
    .insert({ user_id: user.userId, time_in: new Date().toISOString(), time_in_photo: photo_path })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "time_records",
    entityId: data.id,
    diff: { event: "clock_in", photo: Boolean(photo_path) },
  });
  revalidatePath("/attendance");
  return { ok: true };
}

/** Clock OUT — closes the open record and computes hours. */
export async function clockOut(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireModule("attendance");
  const supabase = await createClient();

  const { data: open } = await supabase
    .from("time_records")
    .select("id, time_in")
    .eq("user_id", user.userId)
    .is("time_out", null)
    .order("time_in", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!open) return { ok: false, error: "You are not clocked in." };

  const photo_path = await uploadPhoto(user.userId, "out", formData.get("photo"));
  const now = new Date();
  const hours = open.time_in
    ? Math.round(((now.getTime() - new Date(open.time_in).getTime()) / 3_600_000) * 100) / 100
    : null;

  const { error } = await supabase
    .from("time_records")
    .update({ time_out: now.toISOString(), time_out_photo: photo_path, hours })
    .eq("id", open.id);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "time_records",
    entityId: open.id,
    diff: { event: "clock_out", hours, photo: Boolean(photo_path) },
  });
  revalidatePath("/attendance");
  return { ok: true };
}
