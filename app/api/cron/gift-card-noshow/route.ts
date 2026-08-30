import { NextResponse } from "next/server";
import { listOverdueReservations } from "@/lib/gift-cards/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const overdue = await listOverdueReservations();
  if (overdue.length === 0) return NextResponse.json({ processed: 0 });

  const admin = createAdminClient();
  let processed = 0;

  for (const r of overdue) {
    const { data: card } = await admin
      .from("gift_cards")
      .select("balance_hours, is_active")
      .eq("id", r.gift_card_id)
      .maybeSingle();
    if (!card) continue;
    const row = card as Record<string, unknown>;
    if (!row.is_active) continue;

    const balance = Number(row.balance_hours);
    const penalty = Math.min(1, balance);
    const newBalance = Math.round((balance - penalty) * 100) / 100;
    const now = new Date().toISOString();

    await admin.from("gift_cards").update({ balance_hours: newBalance }).eq("id", r.gift_card_id);
    await admin.from("gift_card_transactions").insert({
      gift_card_id: r.gift_card_id,
      reservation_id: r.id,
      type: "no_show",
      hours: -penalty,
      balance_after: newBalance,
      notes: "Auto no-show (cron)",
    });
    await admin.from("gift_card_reservations")
      .update({ status: "no_show", no_show_at: now })
      .eq("id", r.id);

    processed++;
  }

  return NextResponse.json({ processed });
}
