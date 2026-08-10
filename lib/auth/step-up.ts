import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPasscode } from "@/lib/employees/passcode";

/**
 * Step-up re-authentication for high-risk corrections (editing a collection,
 * reverting a transmittal, …). The actor must provide a justification, type the
 * exact phrase "CONFIRM EDIT", and re-enter THEIR employee code + passcode.
 * Returns the justification on success so the caller can log it.
 */
export async function verifyStepUp(
  userId: string,
  formData: FormData,
): Promise<{ ok: true; justification: string } | { ok: false; error: string }> {
  const justification = String(formData.get("justification") ?? "").trim();
  const confirmText = String(formData.get("confirm_text") ?? "").trim();
  const employeeNo = String(formData.get("employee_no") ?? "").trim();
  const passcode = String(formData.get("passcode") ?? "").trim();

  if (justification.length < 10) return { ok: false, error: "Enter a clear justification (at least 10 characters)." };
  if (confirmText !== "CONFIRM EDIT") return { ok: false, error: "Type the phrase CONFIRM EDIT exactly to proceed." };
  if (!employeeNo || !passcode) return { ok: false, error: "Enter your employee code and passcode." };

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from("profiles")
    .select("employee_no, passcode_hash")
    .eq("id", userId)
    .maybeSingle();
  if (!prof?.employee_no || !prof.passcode_hash) {
    return { ok: false, error: "Your account has no employee code/passcode set. Ask an admin to set one." };
  }
  if (prof.employee_no !== employeeNo || hashPasscode(employeeNo, passcode) !== prof.passcode_hash) {
    return { ok: false, error: "Employee code or passcode is incorrect." };
  }
  return { ok: true, justification };
}
