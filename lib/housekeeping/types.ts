export interface RoomSupply {
  id: string;
  name: string;
  unit_label: string;
  stock_qty: number;
  reorder_level: number;
  is_active: boolean;
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
