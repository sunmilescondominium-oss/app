import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { getEmployeeBasics, getEmployeeProfile, listEmployeeDocuments } from "@/lib/employees/personnel";
import { PageHeader } from "@/components/ui";
import { Avatar } from "@/components/employees/avatar";
import { PersonnelForm } from "@/components/employees/personnel-form";
import { EmployeeDocs } from "@/components/employees/employee-docs";

export const metadata = { title: "201 File" };

const roleLabel = (k: string) => k.replace(/_/g, " ");

export default async function EmployeeFilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("employees");
  const { id } = await params;

  const [basics, profile, docs] = await Promise.all([
    getEmployeeBasics(id),
    getEmployeeProfile(id),
    listEmployeeDocuments(id),
  ]);
  if (!basics) notFound();

  return (
    <>
      <div className="mb-4">
        <Link href="/employees" className="text-xs text-amber-700 hover:underline">← Back to Employees</Link>
        <PageHeader title="201 File" subtitle="Personnel record & documents." />
      </div>

      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5">
        <Avatar id={id} label={basics.label} photoPath={basics.photoPath} size={64} />
        <div>
          <p className="text-lg font-semibold text-stone-800">{basics.label}</p>
          <p className="text-sm text-stone-500">{basics.email ?? "—"}{basics.employeeNo ? ` · ID ${basics.employeeNo}` : ""}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {basics.roleKeys.map((r) => (
              <span key={r} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] capitalize text-stone-600">{roleLabel(r)}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <PersonnelForm userId={id} profile={profile} fullName={basics.fullName} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Documents</h2>
          <EmployeeDocs userId={id} docs={docs} />
        </div>
      </div>
    </>
  );
}
