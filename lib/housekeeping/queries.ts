import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  RoomSupply,
  HousekeepingTask,
  HousekeepingEvent,
  HKChecklistItem,
  TaskDetail,
} from "./types";

function mapTask(r: Record<string, unknown>): HousekeepingTask {
  const u = r.units as { unit_number: string } | null;
  const cl = Array.isArray(r.checklist) ? (r.checklist as HKChecklistItem[]) : [];
  return {
    id: r.id as string,
    unit_id: (r.unit_id as string) ?? null,
    stay_id: (r.stay_id as string) ?? null,
    status: r.status as string,
    assigned_to_role: (r.assigned_to_role as string) ?? null,
    shift: (r.shift as string) ?? null,
    checklist: cl,
    notes: (r.notes as string) ?? null,
    started_at: (r.started_at as string) ?? null,
    completed_at: (r.completed_at as string) ?? null,
    created_at: r.created_at as string,
    unit_number: u?.unit_number ?? null,
  };
}

function mapSupply(r: Record<string, unknown>): RoomSupply {
  return {
    id: r.id as string,
    name: r.name as string,
    unit_label: r.unit_label as string,
    stock_qty: Number(r.stock_qty),
    reorder_level: Number(r.reorder_level),
    is_active: r.is_active as boolean,
  };
}

export async function listSupplies(): Promise<RoomSupply[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("room_supplies").select("*").eq("is_active", true).order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSupply);
}

export async function listHousekeepingTasks(): Promise<HousekeepingTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("housekeeping_tasks")
    .select("*, units(unit_number)")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapTask);
}

export async function getTaskDetail(id: string): Promise<TaskDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("housekeeping_tasks").select("*, units(unit_number)").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const [{ data: evs }, supplies] = await Promise.all([
    supabase.from("housekeeping_events").select("*").eq("task_id", id).order("at", { ascending: true }),
    listSupplies(),
  ]);

  const events: HousekeepingEvent[] = (evs ?? []).map((e: Record<string, unknown>) => ({
    id: e.id as string,
    task_id: e.task_id as string,
    event_type: e.event_type as string,
    detail: (e.detail as Record<string, unknown>) ?? null,
    actor_role: (e.actor_role as string) ?? null,
    at: e.at as string,
  }));

  return { task: mapTask(data), events, supplies };
}
