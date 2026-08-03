import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface EmployeeProfile {
  address: string | null;
  birthdate: string | null;
  phone: string | null;
  personal_email: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  sss_no: string | null;
  philhealth_no: string | null;
  pagibig_no: string | null;
  tin_no: string | null;
  position: string | null;
  department: string | null;
  employment_type: string | null;
  date_hired: string | null;
  date_regularized: string | null;
  notes: string | null;
}

export interface EmployeeDoc {
  id: string;
  doc_type: string;
  note: string | null;
  created_at: string;
}

export interface EmployeeBasics {
  label: string;
  email: string | null;
  photoPath: string | null;
  roleKeys: string[];
  employeeNo: string | null;
}

/** Name/email/roles/photo for the 201 header. SERVICE ROLE (Employees module). */
export async function getEmployeeBasics(userId: string): Promise<EmployeeBasics | null> {
  const admin = createAdminClient();
  const [{ data: prof }, { data: roles }, userRes] = await Promise.all([
    admin.from("profiles").select("display_label, photo_path, employee_no").eq("id", userId).maybeSingle(),
    admin.from("user_roles").select("role_key").eq("user_id", userId),
    admin.auth.admin.getUserById(userId),
  ]);
  if (!prof) return null;
  return {
    label: (prof.display_label as string) || "Staff",
    email: userRes.data?.user?.email ?? null,
    photoPath: (prof.photo_path as string | null) ?? null,
    roleKeys: (roles ?? []).map((r) => r.role_key as string),
    employeeNo: (prof.employee_no as string | null) ?? null,
  };
}

export async function getEmployeeProfile(userId: string): Promise<EmployeeProfile | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("employee_profiles").select("*").eq("user_id", userId).maybeSingle();
  return (data as EmployeeProfile | null) ?? null;
}

export async function listEmployeeDocuments(userId: string): Promise<EmployeeDoc[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("employee_documents")
    .select("id, doc_type, note, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data as EmployeeDoc[]) ?? [];
}
