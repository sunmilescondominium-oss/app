import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface GuardAlertRow {
  id: string;
  stayId: string;
  unitNumber: string;
  guestLabel: string;
  alertType: "additional_person" | "unauthorized_entry" | "gate_query";
  message: string | null;
  raisedByName: string | null;
  createdAt: string;
}

export interface UnacknowledgedTransfer {
  kind: "unacknowledged_transfer";
  stayId: string;
  unitNumber: string;
  guestLabel: string;
  transferId: string;
  fromUnit: string;
  transferredAt: string;
  minutesPending: number;
}

export interface PersonBypass {
  kind: "person_bypass";
  stayId: string;
  unitNumber: string;
  guestLabel: string;
  personEventId: string;
  personCount: number;
  authorizedAt: string;
  minutesPending: number;
}

export interface EntryCountMismatch {
  kind: "entry_count_mismatch";
  stayId: string;
  unitNumber: string;
  guestLabel: string;
  declaredCount: number;
  confirmedCount: number;
}

export interface UnconfirmedExit {
  kind: "unconfirmed_exit";
  stayId: string;
  unitNumber: string;
  guestLabel: string;
  checkOutAt: string;
  minutesPending: number;
}

export type Discrepancy =
  | UnacknowledgedTransfer
  | PersonBypass
  | EntryCountMismatch
  | UnconfirmedExit;

export interface DiscrepancyReport {
  alerts: GuardAlertRow[];
  discrepancies: Discrepancy[];
  totalIssues: number;
}

function minutesSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

function resolveUnit(raw: unknown): string {
  if (!raw) return "?";
  const u = (Array.isArray(raw) ? (raw as { unit_number: string }[])[0] : raw) as { unit_number: string } | null;
  return u?.unit_number ?? "?";
}

function resolveStay(raw: unknown): { guestLabel: string; unitNumber: string } {
  if (!raw || Array.isArray(raw)) return { guestLabel: "—", unitNumber: "?" };
  const s = raw as { guest_label?: string; units?: unknown };
  return {
    guestLabel: (s.guest_label as string | undefined) ?? "—",
    unitNumber: resolveUnit(s.units),
  };
}

export async function listDiscrepancies(): Promise<DiscrepancyReport> {
  const admin = createAdminClient();
  const threshold15m = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const threshold30m = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const [
    { data: alertRows },
    { data: transferRows },
    { data: personEventRows },
    { data: stayRows },
  ] = await Promise.all([
    admin
      .from("hotel_guard_alerts")
      .select("id, stay_id, alert_type, message, raised_by, created_at, stays(guest_label, units(unit_number))")
      .eq("resolved", false)
      .order("created_at", { ascending: false }),

    admin
      .from("hotel_room_transfers")
      .select("id, to_stay_id, from_unit_id, transferred_at, stays(guest_label, units(unit_number))")
      .eq("guard_acknowledged", false)
      .lt("transferred_at", threshold15m),

    admin
      .from("hotel_stay_person_events")
      .select("id, stay_id, person_count, fee_collected_at, stays(guest_label, units(unit_number))")
      .not("fee_collected_at", "is", null)
      .is("confirmed_at", null)
      .lt("fee_collected_at", threshold30m),

    admin
      .from("stays")
      .select("id, guest_label, guest_count, guard_entry_confirmed, guard_entry_count, guard_exit_confirmed, check_out_at, status, units(unit_number)")
      .in("status", ["active", "checked_out"]),
  ]);

  // Resolve names for guard alert raisers
  const raisedByIds = [
    ...new Set(
      (alertRows ?? []).map((a) => a.raised_by as string | null).filter(Boolean) as string[],
    ),
  ];
  const nameMap: Record<string, string> = {};
  if (raisedByIds.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, display_label")
      .in("id", raisedByIds);
    for (const p of profs ?? []) nameMap[p.id as string] = (p.display_label as string) ?? "Guard";
  }

  // Resolve from_unit_number for transfers
  const fromUnitIds = [...new Set((transferRows ?? []).map((t) => t.from_unit_id as string))];
  const fromUnitMap: Record<string, string> = {};
  if (fromUnitIds.length) {
    const { data: units } = await admin
      .from("units")
      .select("id, unit_number")
      .in("id", fromUnitIds);
    for (const u of units ?? []) fromUnitMap[u.id as string] = u.unit_number as string;
  }

  const alerts: GuardAlertRow[] = (alertRows ?? []).map((a) => {
    const { guestLabel, unitNumber } = resolveStay(a.stays);
    return {
      id: a.id as string,
      stayId: a.stay_id as string,
      unitNumber,
      guestLabel,
      alertType: a.alert_type as GuardAlertRow["alertType"],
      message: (a.message as string | null) ?? null,
      raisedByName: a.raised_by ? (nameMap[a.raised_by as string] ?? null) : null,
      createdAt: a.created_at as string,
    };
  });

  const discrepancies: Discrepancy[] = [];

  for (const t of transferRows ?? []) {
    const { guestLabel, unitNumber } = resolveStay(t.stays);
    discrepancies.push({
      kind: "unacknowledged_transfer",
      stayId: t.to_stay_id as string,
      unitNumber,
      guestLabel,
      transferId: t.id as string,
      fromUnit: fromUnitMap[t.from_unit_id as string] ?? "?",
      transferredAt: t.transferred_at as string,
      minutesPending: minutesSince(t.transferred_at as string),
    });
  }

  for (const ev of personEventRows ?? []) {
    const { guestLabel, unitNumber } = resolveStay(ev.stays);
    discrepancies.push({
      kind: "person_bypass",
      stayId: ev.stay_id as string,
      unitNumber,
      guestLabel,
      personEventId: ev.id as string,
      personCount: Number(ev.person_count),
      authorizedAt: ev.fee_collected_at as string,
      minutesPending: minutesSince(ev.fee_collected_at as string),
    });
  }

  for (const s of stayRows ?? []) {
    const unitNumber = resolveUnit(s.units);

    if (
      s.status === "active" &&
      s.guard_entry_confirmed &&
      s.guard_entry_count != null &&
      Number(s.guard_entry_count) !== Number(s.guest_count)
    ) {
      discrepancies.push({
        kind: "entry_count_mismatch",
        stayId: s.id as string,
        unitNumber,
        guestLabel: s.guest_label as string,
        declaredCount: Number(s.guest_count),
        confirmedCount: Number(s.guard_entry_count),
      });
    }

    if (
      s.status === "checked_out" &&
      !s.guard_exit_confirmed &&
      s.check_out_at &&
      (s.check_out_at as string) < threshold15m
    ) {
      discrepancies.push({
        kind: "unconfirmed_exit",
        stayId: s.id as string,
        unitNumber,
        guestLabel: s.guest_label as string,
        checkOutAt: s.check_out_at as string,
        minutesPending: minutesSince(s.check_out_at as string),
      });
    }
  }

  return { alerts, discrepancies, totalIssues: alerts.length + discrepancies.length };
}

/** Lightweight badge count for the hotel main page — 2 fast queries only. */
export async function countOpenDiscrepancies(): Promise<number> {
  const admin = createAdminClient();
  const threshold15m = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const [{ count: alertCount }, { count: transferCount }] = await Promise.all([
    admin
      .from("hotel_guard_alerts")
      .select("id", { count: "exact", head: true })
      .eq("resolved", false),
    admin
      .from("hotel_room_transfers")
      .select("id", { count: "exact", head: true })
      .eq("guard_acknowledged", false)
      .lt("transferred_at", threshold15m),
  ]);

  return (alertCount ?? 0) + (transferCount ?? 0);
}
