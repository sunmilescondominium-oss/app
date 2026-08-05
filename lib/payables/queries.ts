import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Payee, Payable, PayableType } from "@/lib/payables/types";

export type { Payee, Payable, PayableType } from "@/lib/payables/types";

export const PAYABLE_APPROVER_ROLES = ["owner", "admin", "managing_officer", "accounting"];
export const PAYABLE_RELEASE_ROLES = ["accounting", "admin"];

export async function listPayees(): Promise<Payee[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("payees").select("*").order("kind").order("name");
  const nameById = new Map((data ?? []).map((p) => [p.id as string, p.name as string]));
  return (data ?? []).map((p) => ({
    id: p.id as string, name: p.name as string, kind: p.kind as string,
    parentPayeeId: (p.parent_payee_id as string) ?? null,
    parentName: p.parent_payee_id ? nameById.get(p.parent_payee_id as string) ?? null : null,
    overrideRate: Number(p.override_rate ?? 0), commissionRate: Number(p.commission_rate ?? 0),
    tin: (p.tin as string) ?? null, contact: (p.contact as string) ?? null, isActive: p.is_active as boolean,
  }));
}

export async function listPayables(status?: string): Promise<Payable[]> {
  const admin = createAdminClient();
  let q = admin.from("payables").select("*").order("created_at", { ascending: false }).limit(500);
  if (status) q = q.eq("status", status);
  const [{ data }, { data: payees }] = await Promise.all([q, admin.from("payees").select("id, name, kind")]);
  const payeeById = new Map((payees ?? []).map((p) => [p.id as string, p]));
  return (data ?? []).map((r) => {
    const pe = payeeById.get(r.payee_id as string);
    return {
      id: r.id as string, payeeId: r.payee_id as string, payeeName: (pe?.name as string) ?? "—", payeeKind: (pe?.kind as string) ?? "",
      ptype: r.ptype as PayableType, amount: Number(r.amount), description: (r.description as string) ?? null,
      businessLine: (r.business_line as string) ?? null, refNo: (r.ref_no as string) ?? null,
      parentPayableId: (r.parent_payable_id as string) ?? null, status: r.status as string,
      releaseOrNo: (r.release_or_no as string) ?? null, releaseMethod: (r.release_method as string) ?? null,
      createdAt: r.created_at as string, releasedAt: (r.released_at as string) ?? null,
    };
  });
}

export async function getPayableVoucher(id: string): Promise<
  (Payable & { payeeTin: string | null; payeeContact: string | null; approvedByRole: string | null; releasedByRole: string | null }) | null
> {
  const admin = createAdminClient();
  const { data: r } = await admin.from("payables").select("*").eq("id", id).maybeSingle();
  if (!r) return null;
  const { data: pe } = await admin.from("payees").select("name, kind, tin, contact").eq("id", r.payee_id).maybeSingle();
  return {
    id: r.id as string, payeeId: r.payee_id as string, payeeName: (pe?.name as string) ?? "—", payeeKind: (pe?.kind as string) ?? "",
    ptype: r.ptype as PayableType, amount: Number(r.amount), description: (r.description as string) ?? null,
    businessLine: (r.business_line as string) ?? null, refNo: (r.ref_no as string) ?? null,
    parentPayableId: (r.parent_payable_id as string) ?? null, status: r.status as string,
    releaseOrNo: (r.release_or_no as string) ?? null, releaseMethod: (r.release_method as string) ?? null,
    createdAt: r.created_at as string, releasedAt: (r.released_at as string) ?? null,
    payeeTin: (pe?.tin as string) ?? null, payeeContact: (pe?.contact as string) ?? null,
    approvedByRole: null, releasedByRole: null,
  };
}

export async function payablesSummary(): Promise<{ pending: number; approved: number; released: number }> {
  const admin = createAdminClient();
  const { data } = await admin.from("payables").select("amount, status").neq("status", "cancelled");
  const s = { pending: 0, approved: 0, released: 0 };
  for (const r of data ?? []) {
    const amt = Number(r.amount);
    if (r.status === "pending") s.pending += amt;
    else if (r.status === "approved") s.approved += amt;
    else if (r.status === "released") s.released += amt;
  }
  return s;
}
