import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  RoomSupply,
  HousekeepingTask,
  HousekeepingEvent,
  HKChecklistItem,
  TaskDetail,
  StockMovement,
  RoomTypeConfig,
  OccupiedRoom,
} from "./types";

/** Recent stock movements (dispensing audit log). SERVICE ROLE; page-gated. */
export async function listStockMovements(limit = 50): Promise<StockMovement[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("stock_movements")
    .select("id, delta, reason, balance_after, actor_user_id, actor_role, note, created_at, room_supplies(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((m) => m.actor_user_id as string).filter(Boolean))];
  const label = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, full_name, display_label").in("id", ids);
    for (const p of profs ?? []) label.set(p.id as string, (p.full_name as string) || (p.display_label as string) || "Staff");
  }
  return rows.map((m) => ({
    id: m.id as string,
    supplyName: ((m.room_supplies as { name?: string } | null)?.name as string) ?? "—",
    delta: Number(m.delta),
    reason: m.reason as string,
    balanceAfter: Number(m.balance_after),
    actor: label.get(m.actor_user_id as string) ?? (m.actor_role as string) ?? "—",
    note: (m.note as string | null) ?? null,
    createdAt: m.created_at as string,
  }));
}

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
    photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],
    business_line: (r.business_line as string) ?? null,
    unit_type: (r.unit_type as string) ?? null,
    buffer_minutes: r.buffer_minutes != null ? Number(r.buffer_minutes) : null,
    cleaning_minutes: r.cleaning_minutes != null ? Number(r.cleaning_minutes) : null,
    start_by: (r.start_by as string) ?? null,
    endorsed: Boolean(r.endorsed),
    endorsed_at: (r.endorsed_at as string) ?? null,
    escalated: Boolean(r.escalated),
    escalation_note: (r.escalation_note as string) ?? null,
  };
}

function mapRoomType(r: Record<string, unknown>): RoomTypeConfig {
  const cl = Array.isArray(r.checklist) ? (r.checklist as { key: string; label: string }[]) : [];
  return {
    id: r.id as string,
    business_line: r.business_line as string,
    unit_type: (r.unit_type as string) ?? null,
    label: r.label as string,
    buffer_minutes: Number(r.buffer_minutes),
    cleaning_minutes: Number(r.cleaning_minutes),
    checklist: cl,
    is_active: Boolean(r.is_active),
    sort_order: Number(r.sort_order),
  };
}

/** All room-type cleaning configs (timers + checklist). */
export async function listRoomTypes(): Promise<RoomTypeConfig[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("housekeeping_room_types")
    .select("*")
    .order("business_line", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRoomType);
}

/**
 * Currently-occupied hotel + airbnb rooms, for the attendant's occupancy watch.
 * Rentals are excluded (not attendant-monitored). Sorted by soonest expected
 * checkout first so what will free up next is on top.
 */
export async function listOccupiedRooms(): Promise<OccupiedRoom[]> {
  const supabase = await createClient();
  const [{ data: stays }, { data: leases }] = await Promise.all([
    supabase
      .from("stays")
      .select("id, unit_id, guest_label, check_in_at, planned_hours, units(unit_number)")
      .eq("status", "active"),
    supabase
      .from("leases")
      .select("id, unit_id, tenant_label, start_date, end_at, units(unit_number)")
      .eq("status", "active")
      .eq("business_line", "airbnb"),
  ]);

  const rooms: OccupiedRoom[] = [];
  for (const s of stays ?? []) {
    const u = s.units as { unit_number?: string } | null;
    const checkIn = s.check_in_at as string;
    const out = new Date(new Date(checkIn).getTime() + Number(s.planned_hours ?? 0) * 3600_000).toISOString();
    rooms.push({
      source: "hotel",
      ref_id: s.id as string,
      unit_id: (s.unit_id as string) ?? null,
      unit_number: u?.unit_number ?? null,
      guest_label: (s.guest_label as string) ?? "Guest",
      check_in_at: checkIn,
      expected_out_at: out,
    });
  }
  for (const l of leases ?? []) {
    const u = l.units as { unit_number?: string } | null;
    rooms.push({
      source: "airbnb",
      ref_id: l.id as string,
      unit_id: (l.unit_id as string) ?? null,
      unit_number: u?.unit_number ?? null,
      guest_label: (l.tenant_label as string) ?? "Guest",
      check_in_at: (l.start_date as string) + "T00:00:00Z",
      expected_out_at: (l.end_at as string) ?? null,
    });
  }
  rooms.sort((a, b) => (a.expected_out_at ?? "9999").localeCompare(b.expected_out_at ?? "9999"));
  return rooms;
}

function mapSupply(r: Record<string, unknown>): RoomSupply {
  return {
    id: r.id as string,
    name: r.name as string,
    unit_label: r.unit_label as string,
    stock_qty: Number(r.stock_qty),
    reorder_level: Number(r.reorder_level),
    is_active: r.is_active as boolean,
    is_default: Boolean(r.is_default),
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
