"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type ReportCategory = "general" | "safety" | "compliance" | "suggestion" | "grievance" | "other";

export interface EmployeeReport {
  id: string;
  reporter_id: string;
  reporter_label: string | null;
  subject: string;
  body: string;
  category: ReportCategory;
  is_anonymous: boolean;
  created_at: string;
}

export async function submitReport(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireAuth();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "general") as ReportCategory;
  const is_anonymous = formData.get("is_anonymous") === "1";
  const dpa_consent = formData.get("dpa_consent") === "1";

  if (!subject || subject.length < 5) return { ok: false, error: "Subject must be at least 5 characters." };
  if (!body || body.length < 10) return { ok: false, error: "Report body must be at least 10 characters." };
  if (!dpa_consent) return { ok: false, error: "You must agree to the data privacy notice before submitting." };

  const supabase = await createClient();
  const { error } = await supabase.from("employee_reports").insert({
    reporter_id: user.userId,
    subject,
    body,
    category,
    is_anonymous,
    dpa_consent: true,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/hr/reports");
  return { ok: true };
}

export async function listReports(): Promise<EmployeeReport[]> {
  const user = await requireAuth();
  const admin = createAdminClient();

  if (userHasAnyRole(user, ["admin", "owner", "consultant"])) {
    const { data } = await admin
      .from("employee_reports")
      .select("id, reporter_id, subject, body, category, is_anonymous, created_at, profiles!employee_reports_reporter_id_fkey(display_label)")
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => ({
      id: r.id as string,
      reporter_id: r.reporter_id as string,
      reporter_label: r.is_anonymous ? null : ((r.profiles as unknown as { display_label: string | null } | null)?.display_label ?? null),
      subject: r.subject as string,
      body: r.body as string,
      category: r.category as ReportCategory,
      is_anonymous: r.is_anonymous as boolean,
      created_at: r.created_at as string,
    }));
  }

  // Regular employees see only their own
  const supabase = await createClient();
  const { data } = await supabase
    .from("employee_reports")
    .select("id, reporter_id, subject, body, category, is_anonymous, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id as string,
    reporter_id: r.reporter_id as string,
    reporter_label: r.is_anonymous ? null : user.displayLabel ?? null,
    subject: r.subject as string,
    body: r.body as string,
    category: r.category as ReportCategory,
    is_anonymous: r.is_anonymous as boolean,
    created_at: r.created_at as string,
  }));
}
