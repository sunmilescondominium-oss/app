import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const file = fd.get("file") as File | null;
  const token = fd.get("token") as string | null;

  if (!file || !token) return NextResponse.json({ error: "Missing file or token." }, { status: 400 });

  // Verify token exists and is still pending
  const admin = createAdminClient();
  const { data: req_ } = await admin
    .from("pmt_requests")
    .select("id, status")
    .eq("link_token", token)
    .maybeSingle();

  if (!req_) return NextResponse.json({ error: "Invalid link." }, { status: 403 });
  if (req_.status !== "pending") return NextResponse.json({ error: "Form already submitted." }, { status: 403 });

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${req_.id}/${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error } = await admin.storage
    .from("requisition-docs")
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: signedData } = await admin.storage
    .from("requisition-docs")
    .createSignedUrl(path, 60 * 60 * 24 * 30); // 30-day signed URL

  return NextResponse.json({ url: signedData?.signedUrl ?? path });
}
