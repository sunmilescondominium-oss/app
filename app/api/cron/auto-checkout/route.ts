import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { sendAlert } from "@/lib/alerts/sendAlert";
import { getPayrollSettings } from "@/lib/hr/queries";

export const dynamic = "force-dynamic";

/**
 * End-of-day auto check-out. Any employee still clocked in — with NO approved
 * overtime for today — is auto-checked-out at payroll_settings.auto_checkout_time.
 * The record is flagged (auto_checkout = true) so the missed check-out is on
 * file, and admin is alerted. Schedule ~5 PM Manila (see vercel.json).
 * Protected by CRON_SECRET.
 */
function authorized(req: NextRequest): boolean {
  const secret = serverEnv.cronSecret;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const settings = await getPayrollSettings();
  const cutoffIso = `${today}T${settings.auto_checkout_time.slice(0, 5)}:00+08:00`;
  const cutoffMs = new Date(cutoffIso).getTime();

  // Open punches today.
  const { data: open } = await admin
    .from("time_records")
    .select("id, user_id, time_in")
    .eq("work_date", today)
    .is("time_out", null);

  if (!open || open.length === 0) return NextResponse.json({ ok: true, closed: 0, date: today });

  // Users with an approved overtime request today are left alone.
  const { data: ot } = await admin
    .from("leave_requests")
    .select("user_id")
    .eq("category", "overtime")
    .eq("status", "approved")
    .lte("start_date", today)
    .gte("end_date", today);
  const otUsers = new Set((ot ?? []).map((r) => r.user_id as string));

  const labels = new Map<string, string>();
  const ids = open.map((r) => r.user_id as string);
  const { data: profs } = await admin.from("profiles").select("id, full_name, display_label").in("id", ids);
  for (const p of profs ?? []) labels.set(p.id as string, (p.full_name as string) || (p.display_label as string) || "Staff");

  const closedNames: string[] = [];
  for (const rec of open) {
    if (otUsers.has(rec.user_id as string)) continue;
    const inMs = rec.time_in ? new Date(rec.time_in as string).getTime() : cutoffMs;
    const outMs = Math.max(cutoffMs, inMs); // never before time-in
    const hours = Math.round(((outMs - inMs) / 3_600_000) * 100) / 100;
    await admin
      .from("time_records")
      .update({ time_out: new Date(outMs).toISOString(), hours, auto_checkout: true })
      .eq("id", rec.id);
    closedNames.push(labels.get(rec.user_id as string) ?? "Staff");
  }

  let alert = null;
  if (closedNames.length > 0) {
    alert = await sendAlert({
      subject: `⚠️ Auto check-out — ${closedNames.length} did not clock out (${today})`,
      body:
        `These employees did not clock out and were auto-checked-out at ${settings.auto_checkout_time.slice(0, 5)}:\n` +
        closedNames.map((n) => ` • ${n}`).join("\n") +
        `\n\nMissing check-outs are recorded (flagged) for review.`,
    });
  }

  return NextResponse.json({ ok: true, closed: closedNames.length, date: today, alert });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
