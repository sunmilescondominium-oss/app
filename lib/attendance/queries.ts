import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TimeRecord } from "@/lib/hr/types";

/** The caller's currently-open record (clocked in, not yet out), if any. */
export async function myOpenRecord(userId: string): Promise<TimeRecord | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("time_records")
    .select("*")
    .eq("user_id", userId)
    .is("time_out", null)
    .order("time_in", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as TimeRecord | null) ?? null;
}

/** The caller's recent records (own rows only, enforced by RLS). */
export async function myRecentRecords(userId: string, limit = 20): Promise<TimeRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("time_records")
    .select("*")
    .eq("user_id", userId)
    .order("time_in", { ascending: false, nullsFirst: false })
    .limit(limit);
  return (data as TimeRecord[]) ?? [];
}
