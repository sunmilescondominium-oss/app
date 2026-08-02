import { type NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Auth-gated staff photo — the person themselves or an Employees-roster reader. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (user.userId !== id && !canReadModule(user.roleKeys, "employees")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("photo_path").eq("id", id).maybeSingle();
  const path = prof?.photo_path as string | null;
  if (!path) return new NextResponse("Not found", { status: 404 });

  const { data: signed, error } = await admin.storage.from("staff-photos").createSignedUrl(path, 120);
  if (error || !signed?.signedUrl) return new NextResponse("Could not create link", { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
