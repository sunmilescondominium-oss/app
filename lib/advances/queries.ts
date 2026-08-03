import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CashAdvance, Liquidation } from "./types";

/** SERVICE ROLE — gated by requireModule("advances") at the page. */

function mapAdvance(a: Record<string, unknown>): CashAdvance {
  return {
    id: a.id as string,
    user_id: a.user_id as string,
    amount: Number(a.amount),
    purpose: a.purpose as string,
    needed_by: (a.needed_by as string | null) ?? null,
    status: a.status as string,
    decision_note: (a.decision_note as string | null) ?? null,
    released_on: (a.released_on as string | null) ?? null,
    liquidated_total: a.liquidated_total == null ? null : Number(a.liquidated_total),
    liquidated_on: (a.liquidated_on as string | null) ?? null,
    created_at: a.created_at as string,
  };
}

/** All advances (managers) or just the caller's own. */
export async function listAdvances(userId: string, isManager: boolean): Promise<CashAdvance[]> {
  const admin = createAdminClient();
  let q = admin.from("cash_advances").select("*").order("created_at", { ascending: false }).limit(200);
  if (!isManager) q = q.eq("user_id", userId);
  const { data } = await q;
  const rows = (data ?? []).map(mapAdvance);

  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, full_name, display_label").in("id", ids);
    const label = new Map((profs ?? []).map((p) => [p.id as string, (p.full_name as string) || (p.display_label as string) || "Staff"]));
    for (const r of rows) r.label = label.get(r.user_id) ?? "Staff";
  }
  return rows;
}

export async function getAdvance(id: string): Promise<{ advance: CashAdvance; label: string; lines: Liquidation[]; liquidated: number } | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("cash_advances").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const advance = mapAdvance(data);

  const [{ data: prof }, { data: lines }] = await Promise.all([
    admin.from("profiles").select("full_name, display_label").eq("id", advance.user_id).maybeSingle(),
    admin.from("cash_advance_liquidations").select("id, description, amount, spent_on").eq("advance_id", id).order("spent_on", { ascending: true }),
  ]);
  const mapped = (lines ?? []).map((l) => ({ id: l.id as string, description: l.description as string, amount: Number(l.amount), spent_on: l.spent_on as string }));
  const liquidated = Math.round(mapped.reduce((s, l) => s + l.amount, 0) * 100) / 100;

  return {
    advance,
    label: (prof?.full_name as string) || (prof?.display_label as string) || "Staff",
    lines: mapped,
    liquidated,
  };
}
