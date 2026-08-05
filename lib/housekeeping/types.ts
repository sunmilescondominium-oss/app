export interface RoomSupply {
  id: string;
  name: string;
  unit_label: string;
  stock_qty: number;
  reorder_level: number;
  is_active: boolean;
  is_default: boolean;
}

export interface StockMovement {
  id: string;
  supplyName: string;
  delta: number;
  reason: string;
  balanceAfter: number;
  actor: string;
  note: string | null;
  createdAt: string;
}

export interface HKChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

export interface HousekeepingTask {
  id: string;
  unit_id: string | null;
  stay_id: string | null;
  status: string;
  assigned_to_role: string | null;
  shift: string | null;
  checklist: HKChecklistItem[];
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  unit_number: string | null;
  photos: string[];
  // Shift-change / SLA
  business_line: string | null;
  unit_type: string | null;
  buffer_minutes: number | null;
  cleaning_minutes: number | null;
  start_by: string | null;      // ISO — must begin cleaning by this time
  endorsed: boolean;            // carried over to the next team
  endorsed_at: string | null;
  escalated: boolean;
  escalation_note: string | null;
}

/** Per-room-type cleaning config (timers + checklist). */
export interface RoomTypeConfig {
  id: string;
  business_line: string;
  unit_type: string | null;     // null = default for the business line
  label: string;
  buffer_minutes: number;
  cleaning_minutes: number;
  checklist: { key: string; label: string }[];
  is_active: boolean;
  sort_order: number;
}

/** A currently-occupied room the attendant can watch (hotel stay / airbnb lease). */
export interface OccupiedRoom {
  source: "hotel" | "airbnb";
  ref_id: string;               // stay id or lease id
  unit_id: string | null;
  unit_number: string | null;
  guest_label: string;
  check_in_at: string;          // ISO
  expected_out_at: string | null; // ISO — planned checkout / lease end
}

export interface HousekeepingEvent {
  id: string;
  task_id: string;
  event_type: string;
  detail: Record<string, unknown> | null;
  actor_role: string | null;
  at: string;
}

export interface TaskDetail {
  task: HousekeepingTask;
  events: HousekeepingEvent[];
  supplies: RoomSupply[];
}
