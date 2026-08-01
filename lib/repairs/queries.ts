import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { RepairRequest } from "./types";

export async function listRepairRequests(): Promise<RepairRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repair_requests")
    .select("*, units(unit_number, properties(name))")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r: Record<string, unknown>) => {
    const u = r.units as { unit_number: string; properties?: { name?: string } | null } | null;
    return {
      id: r.id as string,
      ticket_ref: r.ticket_ref as string,
      unit_id: (r.unit_id as string) ?? null,
      requester_type: r.requester_type as string,
      requester_ref: (r.requester_ref as string) ?? null,
      requester_contact: (r.requester_contact as string) ?? null,
      issue_type: r.issue_type as string,
      description: r.description as string,
      urgency: r.urgency as string,
      photo_path: (r.photo_path as string) ?? null,
      status: r.status as string,
      assigned_to_role: (r.assigned_to_role as string) ?? null,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      unit: u ? { unit_number: u.unit_number, property_name: u.properties?.name } : null,
    };
  });
}
