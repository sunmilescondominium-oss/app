import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { getStayDetail, listMenuItems, getLatestRoomCheck } from "@/lib/hotel/queries";
import { stayTotals } from "@/lib/hotel/rates";
import { computeTax } from "@/lib/hotel/tax";
import { peso } from "@/lib/collections/summary";
import { APP_BRAND_SHORT, HOTEL_PAYMENT_METHODS } from "@/lib/config";
import { OrdersPanel } from "@/components/hotel/orders-panel";
import { ReceiptFrame } from "@/components/hotel/receipt-frame";
import { FolioActions } from "@/components/hotel/folio-actions";
import { RoomCheck } from "@/components/hotel/room-check";

export const metadata = { title: "Folio" };

const METHOD_LABEL = Object.fromEntries(HOTEL_PAYMENT_METHODS.map((m) => [m.key, m.label]));

export default async function StayFolioPage({
  params,
}: {
  params: Promise<{ stayId: string }>;
}) {
  const { stayId } = await params;
  const user = await requireModule("hotel");
  const canWrite = canWriteModule(user.roleKeys, "hotel");
  const [detail, menu, roomCheck] = await Promise.all([
    getStayDetail(stayId),
    listMenuItems(),
    getLatestRoomCheck(stayId),
  ]);
  if (!detail) notFound();

  const { stay, payments, orders } = detail;
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const ordersTotal = orders.reduce((s, o) => s + o.qty * o.unit_price, 0);
  const t = stayTotals(stay, paid, ordersTotal);
  const tax = computeTax(t.total, stay.tax_mode, stay.tax_rate);

  return (
    <>
      <div className="no-print mb-4">
        <Link href="/hotel" className="text-sm font-medium text-amber-700 hover:underline">
          ← Room board
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {stay.status === "active" && (
            <OrdersPanel stayId={stay.id} orders={orders} menu={menu} canWrite={canWrite} />
          )}
          {stay.status === "active" && canWrite && (
            <RoomCheck stayId={stay.id} gatepassNo={roomCheck?.gatepass_no ?? null} />
          )}
          {canWrite && <FolioActions stayId={stay.id} status={stay.status} balance={t.balance} />}
        </div>

        <ReceiptFrame>
          <div className="border-b border-dashed border-slate-300 pb-2 text-center">
            <p className="text-sm font-bold">{APP_BRAND_SHORT}</p>
            <p>Guest Folio / Receipt</p>
          </div>

          <div className="mt-2 space-y-0.5">
            <Line k="Guest" v={stay.guest_label} />
            <Line k="Room" v={detail.unit_number ?? "—"} />
            <Line k="Plan" v={detail.rate_plan_name ?? "—"} />
            <Line k="Hours" v={`${stay.planned_hours}h`} />
            <Line k="In" v={new Date(stay.check_in_at).toLocaleString()} />
            {stay.check_out_at && <Line k="Out" v={new Date(stay.check_out_at).toLocaleString()} />}
          </div>

          <div className="mt-2 space-y-0.5 border-t border-dashed border-slate-300 pt-2">
            <Line k="Room charge" v={peso(t.room_charge)} />
            {orders.map((o) => (
              <Line key={o.id} k={`${o.qty}× ${o.name}`} v={peso(o.qty * o.unit_price)} />
            ))}
            {t.discount > 0 && <Line k="Discount" v={`- ${peso(t.discount)}`} />}
            <div className="flex justify-between border-t border-slate-300 pt-1 font-bold">
              <span>TOTAL</span>
              <span className="tabular-nums">{peso(t.total)}</span>
            </div>
          </div>

          {tax.mode !== "none" && (
            <div className="mt-2 space-y-0.5 border-t border-dashed border-slate-300 pt-2 text-[11px] text-slate-600">
              {tax.mode === "vat_inclusive" ? (
                <>
                  <Line k="VATable (net)" v={peso(tax.net)} />
                  <Line k={tax.label} v={peso(tax.tax)} />
                </>
              ) : (
                <Line k={tax.label} v={peso(tax.tax)} />
              )}
            </div>
          )}

          <div className="mt-2 space-y-0.5 border-t border-dashed border-slate-300 pt-2">
            {payments.map((p) => (
              <Line
                key={p.id}
                k={`${METHOD_LABEL[p.method] ?? p.method}${p.receipt_no ? ` ${p.receipt_no}` : ""}`}
                v={peso(p.amount)}
              />
            ))}
            <Line k="Paid" v={peso(t.paid)} />
            <div className="flex justify-between font-bold">
              <span>BALANCE</span>
              <span className="tabular-nums">{peso(t.balance)}</span>
            </div>
          </div>

          <p className="mt-3 text-center text-[10px] text-slate-400">
            Thank you! · {new Date().toLocaleString()}
          </p>
        </ReceiptFrame>
      </div>
    </>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{k}</span>
      <span className="text-right tabular-nums">{v}</span>
    </div>
  );
}
