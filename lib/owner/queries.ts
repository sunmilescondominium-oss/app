import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayManila } from "@/lib/collections/summary";

/**
 * The Owner Dashboard is system-generated. RLS intentionally excludes the owner
 * role from collections/buyers/disputes, so this snapshot is computed with the
 * service role and only simplified totals are shown to the owner.
 */
export interface OwnerSnapshot {
  today: string;
  weekStart: string;
  weekTotal: number;
  todayTotal: number;
  occupancyPct: number;
  occupied: number;
  totalUnits: number;
  openIssues: number;
  escalated: number;
  overdueBuyers: number;
  decisions: string[];
}

function daysAgoManila(n: number): string {
  const [y, m, d] = todayManila().split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

export async function getOwnerSnapshot(): Promise<OwnerSnapshot> {
  const admin = createAdminClient();
  const today = todayManila();
  const weekStart = daysAgoManila(6);

  const [colsRes, unitsRes, disputesRes, buyersRes] = await Promise.all([
    admin.from("collections").select("amount, collected_on").gte("collected_on", weekStart),
    admin.from("units").select("status").eq("is_active", true),
    admin.from("disputes").select("status, target_date").eq("is_reference", false),
    admin.from("buyers").select("payment_status").eq("is_active", true),
  ]);

  const cols = (colsRes.data ?? []) as { amount: number; collected_on: string }[];
  const weekTotal = cols.reduce((s, c) => s + Number(c.amount), 0);
  const todayTotal = cols
    .filter((c) => c.collected_on === today)
    .reduce((s, c) => s + Number(c.amount), 0);

  const units = (unitsRes.data ?? []) as { status: string }[];
  const totalUnits = units.length;
  const occupied = units.filter((u) => u.status === "occupied").length;
  const occupancyPct = totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0;

  const disputes = (disputesRes.data ?? []) as { status: string; target_date: string | null }[];
  const open = disputes.filter((d) => ["open", "in_progress", "escalated"].includes(d.status));
  const openIssues = open.length;
  const escalated = disputes.filter((d) => d.status === "escalated").length;
  const pastTarget = open.filter((d) => d.target_date && d.target_date < today).length;

  const buyers = (buyersRes.data ?? []) as { payment_status: string }[];
  const overdueBuyers = buyers.filter((b) => b.payment_status === "overdue").length;

  const decisions: string[] = [];
  if (escalated > 0) decisions.push(`${escalated} case${escalated > 1 ? "s" : ""} were escalated and need your decision.`);
  if (overdueBuyers > 0) decisions.push(`${overdueBuyers} buyer${overdueBuyers > 1 ? "s are" : " is"} behind on payments.`);
  if (pastTarget > 0) decisions.push(`${pastTarget} case${pastTarget > 1 ? "s are" : " is"} past the target date.`);

  return {
    today,
    weekStart,
    weekTotal,
    todayTotal,
    occupancyPct,
    occupied,
    totalUnits,
    openIssues,
    escalated,
    overdueBuyers,
    decisions,
  };
}
