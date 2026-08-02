import { type NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSessionUser } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** PNG QR badge for an employee (Employees-roster readers only). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user || !canReadModule(user.roleKeys, "employees")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("qr_token").eq("id", id).maybeSingle();
  const token = data?.qr_token as string | null;
  if (!token) return new NextResponse("No QR set", { status: 404 });

  const png = await QRCode.toBuffer(token, { width: 320, margin: 2 });
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}
