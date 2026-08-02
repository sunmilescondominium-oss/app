import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { LeaveRequest } from "@/lib/employees/types";

/** Self-service reads — RLS restricts every row to the calling user. */

export async function myPhotoPath(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("photo_path").eq("id", userId).maybeSingle();
  return (data?.photo_path as string | null) ?? null;
}

export async function myLeave(userId: string): Promise<LeaveRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_requests")
    .select("id, user_id, category, leave_type, start_date, end_date, days, hours, reason, status, decided_at, decision_note")
    .eq("user_id", userId)
    .order("start_date", { ascending: false });
  return (data as LeaveRequest[]) ?? [];
}
