import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule, canReadModule } from "@/lib/rbac/modules";
import { getStayDetail, listMenuItems, getLatestRoomCheck } from "@/lib/hotel/queries";
import { getSuggestedNextArNo } from "@/lib/hotel/session";
import { stayTotals } from "@/lib/hotel/rates";
import { computeTax } from "@/lib/hotel/tax";
import { peso, fmtDateTime } from "@/lib/collections/summary";
import { getAppTimezone } from "@/lib/settings/app-settings";
import { APP_BRAND_SHORT, HOTEL_PAYMENT_METHODS } from "@/lib/config";
import { OrdersPanel } from "@/components/hotel/orders-panel";
import { ReceiptFrame } from "@/components/hotel/receipt-frame";
import { FolioActions } from "@/components/hotel/folio-actions";
import { RoomCheck } from "@/components/hotel/room-check";
import { DeleteStayButton, DeletePaymentButton } from "@/components/hotel/consultant-delete";
import { listDocPhotos } from "@/lib/docs/photos";
import { PhotoDocPanel } from "@/components/capture/photo-doc-panel";

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
  const isConsultant = user.roleKeys.includes("consultant");
  const [detail, menu, roomCheck, damagePhotos, tz, suggestedArNo] = await Promise.all([
    getStayDetail(stayId),
    listMenuItems(),
    getLatestRoomCheck(stayId),
    listDocPhotos("stay", stayId),
    getAppTimezone(),
    getSuggestedNextArNo(),
  ]);
  if (!detail) notFound();

  const { stay, payments, orders } = detail;
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const ordersTotal = orders.reduce((s, o) => s + o.qty * o.unit_price, 0);
  const t = stayTotals(stay, paid, ordersTotal);
  const tax = computeTax(t.total, stay.tax_mode, stay.tax_rate);

  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link href="/hotel" className="text-sm font-medium text-amber-700 hover:underline">
          ← Room board
        </Link>
        {isConsultant && <DeleteStayButton stayId={stayId} />}
      </div>

      {/* Guest requests from the QR bill portal */}
      {stay.status === "active" && (stay.checkout_requested || stay.extension_requested_hours != null) && (
        <div className="no-print mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {stay.checkout_requested && <p>🔔 <strong>Guest requested check-out</strong> — prepare the final bill, check the unit, and issue the gate pass.</p>}
          {stay.extension_requested_hours != null && <p>⏱️ <strong>Guest requested +{stay.extension_requested_hours}h</strong> — confirm the extension below.</p>}
        </div>
      )}

      {/* Guest bill QR — print/show to the guest */}
      {stay.portal_token && (
        <div className="no-print mb-4 flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/guest/${stay.portal_token}/qr`} alt="Guest bill QR" className="h-24 w-24" />
          <div className="text-sm">
            <p className="font-medium text-stone-800">Guest bill QR</p>
            <p className="text-stone-500">The guest scans this to see their bill + timer, request an extension, or check out.</p>
            <a href={`/guest/${stay.portal_token}`} target="_blank" rel="noreferrer" className="text-xs text-amber-700 hover:underline">open guest view ↗</a>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {stay.status === "active" && (
            <OrdersPanel stayId={stay.id} orders={orders} menu={menu} canWrite={canWrite} />
          )}
          {stay.status === "active" && canWrite && (
            <RoomCheck stayId={stay.id} gatepassNo={roomCheck?.gatepass_no ?? null} />
          )}
          {canWrite && <FolioActions stayId={stay.id} status={stay.status} balance={t.balance} checkInAt={stay.check_in_at} suggestedArNo={suggestedArNo} />}
          <PhotoDocPanel
            entity="stay"
            entityId={stay.id}
            kind="checkout_damage"
            title="Damage / lost-item evidence"
            label="Hotel checkout · damage/lost item"
            canWrite={canWrite}
            canView={canReadModule(user.roleKeys, "media")}
            photos={damagePhotos}
            allowVideo
          />
        </div>

        <ReceiptFrame>
          <div className="border-b border-dashed border-stone-300 pb-2 text-center">
            <p className="text-sm font-bold">{APP_BRAND_SHORT}</p>
            <p>Guest Folio / Receipt</p>
          </div>

          <div className="mt-2 space-y-0.5">
            <Line k="Guest" v={stay.guest_label} />
            <Line k="Room" v={detail.unit_number ?? "—"} />
            <Line k="Plan" v={detail.rate_plan_name ?? "—"} />
            <Line k="Hours" v={`${stay.planned_hours}h`} />
            <Line k="In" v={fmtDateTime(stay.check_in_at, tz)} />
            {stay.check_out_at && <Line k="Out" v={fmtDateTime(stay.check_out_at, tz)} />}
          </div>

          <div className="mt-2 space-y-0.5 border-t border-dashed border-stone-300 pt-2">
            <Line k="Room charge" v={peso(t.room_charge)} />
            {orders.map((o) => (
              <Line key={o.id} k={`${o.qty}× ${o.name}`} v={peso(o.qty * o.unit_price)} />
            ))}
            {t.discount > 0 && (
                <Line
                  k={stay.discount_type === "pwd" ? "Discount (PWD 20%)" : stay.discount_type === "senior_citizen" ? "Discount (Senior Citizen 20%)" : "Discount"}
                  v={`- ${peso(t.discount)}`}
                />
              )}
            <div className="flex justify-between border-t border-stone-300 pt-1 font-bold">
              <span>TOTAL</span>
              <span className="tabular-nums">{peso(t.total)}</span>
            </div>
          </div>

          {tax.mode !== "none" && (
            <div className="mt-2 space-y-0.5 border-t border-dashed border-stone-300 pt-2 text-[11px] text-stone-600">
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

          <div className="mt-2 space-y-0.5 border-t border-dashed border-stone-300 pt-2">
            {payments.map((p) => {
              const label = `${METHOD_LABEL[p.method] ?? p.method}${p.receipt_no ? ` ${p.receipt_no}` : ""}${p.ar_no ? ` · ${p.ar_no}` : ""}`;
              return (
                <div key={p.id} className="flex items-center justify-between gap-1">
                  <span className="text-stone-500 text-[11px]">{label}</span>
                  <span className="flex items-center tabular-nums text-[11px]">
                    {peso(p.amount)}
                    {isConsultant && <DeletePaymentButton paymentId={p.id} stayId={stayId} label={label} />}
                  </span>
                </div>
              );
            })}
            <Line k="Paid" v={peso(t.paid)} />
            <div className="flex justify-between font-bold">
              <span>BALANCE</span>
              <span className="tabular-nums">{peso(t.balance)}</span>
            </div>
          </div>

          {stay.portal_token && (
            <div className="mt-3 flex flex-col items-center border-t border-dashed border-stone-300 pt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/guest/${stay.portal_token}/qr`} alt="Scan for your live bill" className="h-24 w-24" />
              <p className="mt-1 text-center text-[10px] text-stone-500">Scan to view your bill, countdown &amp; extend</p>
            </div>
          )}
          <p className="mt-3 text-center text-[10px] text-stone-400">
            Thank you! · {fmtDateTime(new Date(), tz)}
          </p>
        </ReceiptFrame>
      </div>
    </>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-stone-500">{k}</span>
      <span className="text-right tabular-nums">{v}</span>
    </div>
  );
}
