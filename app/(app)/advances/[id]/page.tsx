import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { getAdvance } from "@/lib/advances/queries";
import { peso } from "@/lib/collections/summary";
import { ADVANCE_STATUSES } from "@/lib/config";
import { PageHeader, Breadcrumb } from "@/components/ui";
import { LiquidationForm, CloseLiquidation } from "@/components/advances/advance-forms";

export const metadata = { title: "Cash Advance" };
const label = (k: string) => ADVANCE_STATUSES.find((s) => s.key === k)?.label ?? k;

export default async function AdvanceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("advances");
  const { id } = await params;
  const data = await getAdvance(id);
  if (!data) notFound();
  const { advance, label: who, lines, liquidated } = data;

  const balance = Math.round((advance.amount - liquidated) * 100) / 100;
  const canLiquidate = advance.status === "released";

  return (
    <>
      <div className="mb-4">
        <Breadcrumb items={[{ label: "Cash Advance", href: "/advances" }, { label: "Request" }]} />
        <PageHeader title={`Advance — ${peso(advance.amount)}`} subtitle={`${who} · ${advance.purpose}`} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          { k: "Status", v: label(advance.status) },
          { k: "Advance", v: peso(advance.amount) },
          { k: "Liquidated", v: peso(liquidated) },
          { k: balance >= 0 ? "Refund due" : "Reimburse", v: peso(Math.abs(balance)) },
        ].map((c) => (
          <div key={c.k} className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-stone-500">{c.k}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-stone-800">{c.v}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Liquidation</h2>
      {canLiquidate ? (
        <div className="mb-3 rounded-2xl border border-stone-200 bg-white p-4">
          <LiquidationForm advanceId={advance.id} />
        </div>
      ) : (
        <p className="mb-3 text-sm text-stone-500">
          {advance.status === "liquidated" ? "This advance has been liquidated." : "Liquidation opens once the advance is released."}
        </p>
      )}

      <div className="table-wrap">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-stone-500">No liquidation lines yet.</td></tr>}
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5">{l.spent_on}</td>
                <td className="px-4 py-2.5">{l.description}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-stone-200 font-semibold">
              <td className="px-4 py-3" colSpan={2}>Total liquidated</td>
              <td className="px-4 py-3 text-right tabular-nums">{peso(liquidated)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {canLiquidate && lines.length > 0 && (
        <div className="mt-4">
          <CloseLiquidation advanceId={advance.id} />
        </div>
      )}
    </>
  );
}
