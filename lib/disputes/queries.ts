import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Dispute } from "./types";

/**
 * lawyer_notes are consultant-visible only: pass canSeeLawyerNotes=false and the
 * field is stripped before it ever leaves the server.
 * TODO(client-confirm): for stricter isolation move lawyer_notes to a separate
 * consultant-only table / column privilege.
 */
export async function listDisputes(canSeeLawyerNotes: boolean): Promise<Dispute[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("disputes")
    .select("*, units(unit_number)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r: Record<string, unknown>) => {
    const u = r.units as { unit_number: string } | null;
    return {
      id: r.id as string,
      unit_id: (r.unit_id as string) ?? null,
      buyer_id: (r.buyer_id as string) ?? null,
      case_ref: (r.case_ref as string) ?? null,
      issue_type: r.issue_type as string,
      status: r.status as string,
      last_action: (r.last_action as string) ?? null,
      next_action: (r.next_action as string) ?? null,
      target_date: (r.target_date as string) ?? null,
      lawyer_notes: canSeeLawyerNotes ? ((r.lawyer_notes as string) ?? null) : null,
      is_reference: r.is_reference as boolean,
      created_at: r.created_at as string,
      unit: u ? { unit_number: u.unit_number } : null,
    };
  });
}
