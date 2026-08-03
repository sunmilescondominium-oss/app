import { type NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Auth-gated download of an employee document (Employees-module readers). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user || !canReadModule(user.roleKeys, "employees")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data: doc } = await admin.from("employee_documents").select("file_path").eq("id", id).maybeSingle();
  if (!doc?.file_path) return new NextResponse("Not found", { status: 404 });

  const { data: signed, error } = await admin.storage.from("employee-documents").createSignedUrl(doc.file_path as string, 60);
  if (error || !signed?.signedUrl) return new NextResponse("Could not create link", { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
