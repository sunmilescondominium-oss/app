import { createClient } from "@/lib/supabase/server";

// Approval-chain roles (role-based, never person-based). ------------------
export const ENDORSE_ROLES = ["operations_manager", "managing_officer", "admin"];
export const BUDGET_ROLES = ["accounting", "admin"];
export const OWNER_ROLES = ["owner", "admin"];
export const PURCHASE_ROLES = ["errand_liaison", "accounting", "operations_manager", "admin"];
export const RECEIVE_ROLES = ["warehouse_timekeeper", "operations_manager", "admin"];

export type ReqStatus =
  | "submitted" | "endorsed" | "budget_review" | "owner_review"
  | "approved" | "rejected" | "purchased" | "received" | "cancelled";

export const STATUS_LABEL: Record<ReqStatus, string> = {
  submitted: "Submitted",
  endorsed: "Endorsed by Operations",
  budget_review: "Budget review",
  owner_review: "Owner review",
  approved: "Approved",
  rejected: "Rejected",
  purchased: "Purchased",
  received: "Received",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<ReqStatus, "slate" | "blue" | "amber" | "green" | "red" | "indigo"> = {
  submitted: "slate", endorsed: "blue", budget_review: "amber", owner_review: "amber",
  approved: "green", rejected: "red", purchased: "indigo", received: "green", cancelled: "slate",
};

export type ReqItem = {
  id: string; itemId: string | null; itemName: string; category: string;
  unitLabel: string; qty: number; estUnitCost: number;
  target: "room_supplies" | "materials"; receivedQty: number;
};

export type Requisition = {
  id: string; refNo: string | null; title: string; businessLine: string | null;
  purpose: string | null; neededBy: string | null; status: ReqStatus; estTotal: number;
  requestedByRole: string | null; endorsedByRole: string | null;
  budgetByRole: string | null; ownerByRole: string | null; rejectReason: string | null;
  supplier: string | null; actualTotal: number | null; purchasedByRole: string | null;
  receivedByRole: string | null; note: string | null; createdAt: string;
};

export type MaterialItem = {
  id: string; name: string; category: string; unitLabel: string;
  stockQty: number; reorderLevel: number; target: "room_supplies" | "materials"; isActive: boolean;
};

function mapReq(r: Record<string, unknown>): Requisition {
  return {
    id: r.id as string, refNo: (r.ref_no as string) ?? null, title: r.title as string,
    businessLine: (r.business_line as string) ?? null, purpose: (r.purpose as string) ?? null,
    neededBy: (r.needed_by as string) ?? null, status: r.status as ReqStatus,
    estTotal: Number(r.est_total ?? 0), requestedByRole: (r.requested_by_role as string) ?? null,
    endorsedByRole: (r.endorsed_by_role as string) ?? null, budgetByRole: (r.budget_by_role as string) ?? null,
    ownerByRole: (r.owner_by_role as string) ?? null, rejectReason: (r.reject_reason as string) ?? null,
    supplier: (r.supplier as string) ?? null, actualTotal: r.actual_total == null ? null : Number(r.actual_total),
    purchasedByRole: (r.purchased_by_role as string) ?? null, receivedByRole: (r.received_by_role as string) ?? null,
    note: (r.note as string) ?? null, createdAt: r.created_at as string,
  };
}

export async function listRequisitions(): Promise<Requisition[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("requisitions").select("*").order("created_at", { ascending: false }).limit(300);
  return (data ?? []).map(mapReq);
}

export async function getRequisition(id: string): Promise<{ req: Requisition; items: ReqItem[] } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("requisitions").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: items } = await supabase.from("requisition_items").select("*").eq("requisition_id", id).order("created_at");
  return {
    req: mapReq(data),
    items: (items ?? []).map((i) => ({
      id: i.id as string, itemId: (i.item_id as string) ?? null, itemName: i.item_name as string,
      category: i.category as string, unitLabel: i.unit_label as string, qty: Number(i.qty),
      estUnitCost: Number(i.est_unit_cost), target: i.target as "room_supplies" | "materials",
      receivedQty: Number(i.received_qty),
    })),
  };
}

export async function listMaterials(): Promise<MaterialItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("material_items").select("*").eq("is_active", true).order("sort_order").order("name");
  return (data ?? []).map((m) => ({
    id: m.id as string, name: m.name as string, category: m.category as string, unitLabel: m.unit_label as string,
    stockQty: Number(m.stock_qty), reorderLevel: Number(m.reorder_level),
    target: m.target as "room_supplies" | "materials", isActive: m.is_active as boolean,
  }));
}

export async function getOwnerThreshold(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("requisition_settings").select("owner_threshold").eq("id", 1).maybeSingle();
  return Number(data?.owner_threshold ?? 20000);
}
