import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * PUBLIC staff photo for the attendance kiosk board (no PMS session).
 * TODO(client-confirm): this URL exposes staff profile photos to anyone who can
 * reach the kiosk page. Keep the kiosk on a trusted network / obscure host, or
 * switch the board to initials-only if that exposure isn't acceptable.
 * Only serves photos of ACTIVE staff who hold a role.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: prof } = await admin.from("profiles").select("photo_path, is_active").eq("id", id).maybeSingle();
  if (!prof?.is_active || !prof.photo_path) return new NextResponse("Not found", { status: 404 });

  const { count } = await admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("user_id", id);
  if (!count) return new NextResponse("Not found", { status: 404 });

  const { data: signed, error } = await admin.storage.from("staff-photos").createSignedUrl(prof.photo_path as string, 120);
  if (error || !signed?.signedUrl) return new NextResponse("Could not create link", { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
