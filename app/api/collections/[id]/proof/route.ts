import { type NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Auth-gated view of an online-payment proof (Collections readers). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user || !canReadModule(user.roleKeys, "collections")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const { data } = await admin.from("collections").select("proof_path").eq("id", id).maybeSingle();
  if (!data?.proof_path) return new NextResponse("Not found", { status: 404 });

  const { data: signed, error } = await admin.storage.from("payment-proofs").createSignedUrl(data.proof_path as string, 60);
  if (error || !signed?.signedUrl) return new NextResponse("Could not create link", { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
