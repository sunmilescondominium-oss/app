import Link from "next/link";
import { redirect } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { myPayslip } from "@/lib/employee/queries";
import { todayManila, peso } from "@/lib/collections/summary";
import { APP_BRAND_SHORT } from "@/lib/config";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "My Payslip" };

function monthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}
function t(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" });
}

export default async function MyPayslipPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireModule("employee");
  if (user.roleKeys.includes("guard")) redirect("/me");
  const sp = await searchParams;
  const from = (typeof sp.from === "string" && sp.from) || monthStart();
  const to = (typeof sp.to === "string" && sp.to) || todayManila();
  const p = await myPayslip(user.userId, from, to);

  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <div>
          <Link href="/me" className="text-xs text-amber-700 hover:underline">← Back to My Portal</Link>
          <PageHeader title="My Payslip" subtitle={`${from} to ${to}`} />
        </div>
        <PrintButton label="Print payslip" />
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="mb-4 border-b border-stone-300 pb-3">
          <p className="text-lg font-bold">{APP_BRAND_SHORT}</p>
          <p className="text-sm">Payslip — {user.displayLabel} · {from} to {to}</p>
          <p className="text-xs text-stone-500">Daily rate: {peso(p.dailyRate)} (hourly {peso(p.dailyRate / 8)})</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "Basic", v: peso(p.basic) },
            { k: "Overtime", v: peso(p.ot) },
            { k: "Night diff", v: peso(p.night) },
            { k: "Deductions", v: `(${peso(p.deductions)})` },
          ].map((c) => (
            <div key={c.k}><p className="text-xs text-stone-400">{c.k}</p><p className="tabular-nums">{c.v}</p></div>
          ))}
        </div>
        <p className="mb-4 text-lg font-bold">Net pay: <span className="tabular-nums">{peso(p.net)}</span></p>

        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="py-2">Date</th><th className="py-2">In</th><th className="py-2">Out</th>
              <th className="py-2 text-right">Reg h</th><th className="py-2 text-right">OT h</th><th className="py-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {p.days.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-stone-500">No records in this range.</td></tr>}
            {p.days.map((d, i) => (
              <tr key={`${d.date}-${i}`} className="border-b border-stone-100">
                <td className="py-1.5">{d.date}</td>
                <td className="py-1.5">{t(d.timeIn)}</td>
                <td className="py-1.5">{t(d.timeOut)}</td>
                <td className="py-1.5 text-right tabular-nums">{d.regularHours}</td>
                <td className="py-1.5 text-right tabular-nums">{d.otHours || "—"}</td>
                <td className="py-1.5 text-right tabular-nums">{peso(d.netPay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-[11px] text-stone-400">Computed from your recorded attendance. Final payroll is confirmed by accounting.</p>
      </div>
    </>
  );
}
