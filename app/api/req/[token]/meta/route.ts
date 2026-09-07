import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("pmt_requests")
    .select("id, status, expires_at, purpose, payee_name, primary_source_type, primary_source_amount, secondary_source_amount")
    .eq("link_token", token)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });

  return NextResponse.json({
    id: data.id,
    status: data.status,
    expiresAt: data.expires_at,
    purpose: data.purpose,
    payeeName: data.payee_name,
    primarySourceType: data.primary_source_type,
    primarySourceAmount: data.primary_source_amount ? Number(data.primary_source_amount) : null,
    secondarySourceAmount: data.secondary_source_amount ? Number(data.secondary_source_amount) : null,
  });
}
