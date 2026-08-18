import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { sendPushToRoles } from "@/lib/push/sender";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Cooldown: don't re-push the same event to the same user within this window.
const COOLDOWN_MIN = 10;

function authorized(req: NextRequest): boolean {
  const secret = serverEnv.cronSecret;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const now = new Date();
  const report: Record<string, number> = { hotel_overdue: 0, hk_start: 0, hk_finish: 0 };

  // ── 1. Hotel overdue stays ──────────────────────────────────────────────────
  // Active stays whose planned_hours window has passed.
  const { data: overdueStays } = await admin
    .from("stays")
    .select("id, guest_label, check_in_at, planned_hours, units(unit_number)")
    .eq("status", "active");

  for (const stay of overdueStays ?? []) {
    const checkIn = new Date(stay.check_in_at as string);
    const planned = (stay.planned_hours as number) * 3_600_000;
    if (now.getTime() < checkIn.getTime() + planned) continue;

    const unit = (stay.units as { unit_number?: string } | null)?.unit_number ?? "—";
    const overByMin = Math.floor((now.getTime() - (checkIn.getTime() + planned)) / 60_000);
    const sent = await sendPushToRoles(
      ["hotel_rental_monitoring", "managing_officer", "admin"],
      {
        title: `⚠️ Room ${unit} overdue checkout`,
        body: `${stay.guest_label} is ${overByMin}m past checkout time. Please follow up.`,
        tag: `hotel_overdue_${stay.id}`,
        url: `/hotel/${stay.id}`,
      },
      `hotel_overdue:${stay.id}`,
      COOLDOWN_MIN,
    );
    report.hotel_overdue += sent;
  }

  // ── 2. Housekeeping: start-by overdue ──────────────────────────────────────
  // Pending tasks whose start_by deadline has passed.
  const { data: pendingTasks } = await admin
    .from("housekeeping_tasks")
    .select("id, start_by, units(unit_number)")
    .eq("status", "pending")
    .not("start_by", "is", null)
    .lt("start_by", now.toISOString());

  for (const task of pendingTasks ?? []) {
    const unit = (task.units as { unit_number?: string } | null)?.unit_number ?? "—";
    const overByMin = Math.floor((now.getTime() - new Date(task.start_by as string).getTime()) / 60_000);
    const sent = await sendPushToRoles(
      ["housekeeper_attendant", "managing_officer", "admin"],
      {
        title: `🧹 Room ${unit} — cleaning not started`,
        body: `Cleaning of Room ${unit} is ${overByMin}m past the start deadline.`,
        tag: `hk_start_${task.id}`,
        url: `/housekeeping/${task.id}`,
      },
      `hk_start:${task.id}`,
      COOLDOWN_MIN,
    );
    report.hk_start += sent;
  }

  // ── 3. Housekeeping: finish-by overdue ────────────────────────────────────
  // In-progress tasks whose cleaning window (started_at + cleaning_minutes) has passed.
  const { data: inProgressTasks } = await admin
    .from("housekeeping_tasks")
    .select("id, started_at, cleaning_minutes, units(unit_number)")
    .eq("status", "in_progress")
    .not("started_at", "is", null)
    .not("cleaning_minutes", "is", null);

  for (const task of inProgressTasks ?? []) {
    const finishBy =
      new Date(task.started_at as string).getTime() + (task.cleaning_minutes as number) * 60_000;
    if (now.getTime() < finishBy) continue;

    const unit = (task.units as { unit_number?: string } | null)?.unit_number ?? "—";
    const overByMin = Math.floor((now.getTime() - finishBy) / 60_000);
    const sent = await sendPushToRoles(
      ["housekeeper_attendant", "managing_officer", "admin"],
      {
        title: `🧹 Room ${unit} — cleaning overdue`,
        body: `Room ${unit} cleaning is ${overByMin}m past the expected finish time.`,
        tag: `hk_finish_${task.id}`,
        url: `/housekeeping/${task.id}`,
      },
      `hk_finish:${task.id}`,
      COOLDOWN_MIN,
    );
    report.hk_finish += sent;
  }

  // ── Prune old log rows (keep table small) ──────────────────────────────────
  try { await admin.rpc("prune_push_log"); } catch { /* best-effort */ }

  return NextResponse.json({ ok: true, sent: report, at: now.toISOString() });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
