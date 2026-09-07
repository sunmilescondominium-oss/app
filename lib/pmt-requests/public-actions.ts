"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashPasscode } from "@/lib/employees/passcode";

export type PublicActionResult = { ok: true } | { ok: false; error: string };

export async function verifyPmtRequestPasscode(token: string, passcode: string): Promise<PublicActionResult & { requestorName?: string }> {
  const admin = createAdminClient();

  const { data: req } = await admin
    .from("pmt_requests")
    .select("id, requestor_user_id, expires_at, status")
    .eq("link_token", token)
    .maybeSingle();

  if (!req) return { ok: false, error: "Invalid or expired link." };
  if (new Date(req.expires_at as string) < new Date()) return { ok: false, error: "This link has expired." };
  if (req.status !== "pending") return { ok: false, error: req.status === "released" ? "This request has already been released." : "This form has already been submitted." };

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, employee_no, passcode_hash")
    .eq("id", req.requestor_user_id as string)
    .maybeSingle();

  if (!profile?.passcode_hash || !profile?.employee_no) {
    return { ok: false, error: "Passcode not configured for this staff member. Contact admin." };
  }

  const expected = hashPasscode(profile.employee_no as string, passcode);
  if (expected !== profile.passcode_hash) return { ok: false, error: "Incorrect passcode." };

  return { ok: true, requestorName: profile.full_name as string };
}

export async function submitPmtRequest(
  token: string,
  passcode: string,
  formData: { description: string; amount_requested: number; supporting_doc_url?: string }
): Promise<PublicActionResult> {
  const admin = createAdminClient();

  const { data: req } = await admin
    .from("pmt_requests")
    .select("id, requestor_user_id, expires_at, status")
    .eq("link_token", token)
    .maybeSingle();

  if (!req) return { ok: false, error: "Invalid link." };
  if (new Date(req.expires_at as string) < new Date()) return { ok: false, error: "This link has expired." };
  if (req.status !== "pending") return { ok: false, error: "This form has already been submitted." };

  const { data: profile } = await admin
    .from("profiles")
    .select("employee_no, passcode_hash")
    .eq("id", req.requestor_user_id as string)
    .maybeSingle();

  if (!profile?.passcode_hash || !profile?.employee_no) return { ok: false, error: "Passcode not configured." };
  const expected = hashPasscode(profile.employee_no as string, passcode);
  if (expected !== profile.passcode_hash) return { ok: false, error: "Incorrect passcode. Submission cancelled." };

  if (!formData.description.trim()) return { ok: false, error: "Please describe your request." };
  if (!formData.amount_requested || formData.amount_requested <= 0) return { ok: false, error: "Enter the amount requested." };

  const { error } = await admin.from("pmt_requests").update({
    description: formData.description.trim(),
    amount_requested: formData.amount_requested,
    supporting_doc_url: formData.supporting_doc_url ?? null,
    submitted_at: new Date().toISOString(),
    status: "submitted",
  }).eq("id", req.id as string);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
