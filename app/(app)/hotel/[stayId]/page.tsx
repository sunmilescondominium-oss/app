import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { canWriteModule, canReadModule } from "@/lib/rbac/modules";
import { getStayDetail, listMenuItems, getLatestRoomCheck, listRoomBoard, getTransferRecord, getMaintenanceIssueForUnit, getPromoName } from "@/lib/hotel/queries";
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
import { TransferRoomModal } from "@/components/hotel/transfer-room-modal";
import { SupervisorOpsPanel } from "@/components/hotel/supervisor-ops-panel";
import { ExtraPersonPanel } from "@/components/hotel/extra-person-panel";
import { MaintenanceIssuePanel } from "@/components/hotel/maintenance-issue-panel";
import { BluetoothPrintButton } from "@/components/printing/bluetooth-print-button";
import type { FolioData } from "@/lib/printing/format-folio";

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
  const isSupervisor = userHasAnyRole(user, ["hotel_rental_monitoring", "admin", "managing_officer", "consultant"]);
  const [detail, menu, roomCheck, damagePhotos, tz, suggestedArNo, board, transferRecord] = await Promise.all([
    getStayDetail(stayId),
    listMenuItems(),
    getLatestRoomCheck(stayId),
    listDocPhotos("stay", stayId),
    getAppTimezone(),
    getSuggestedNextArNo(),
    listRoomBoard(),
    getTransferRecord(stayId),
  ]);
  if (!detail) notFound();

  const [maintenanceIssue, promoName] = await Promise.all([
    getMaintenanceIssueForUnit(detail.stay.unit_id ?? ""),
    detail.stay.promo_id ? getPromoName(detail.stay.promo_id) : Promise.resolve(null),
  ]);

  const { stay, payments, orders, extensions } = detail;
  const foodOrders = orders.filter((o) => o.menu_item_id !== null);
  const extraPersonCharges = orders.filter((o) => o.menu_item_id === null);
  const canManageExtras = userHasAnyRole(user, ["hotel_cashier", "hotel_rental_monitoring", "admin", "managing_officer", "accounting", "consultant"]);
  const canResolveMaintenance = userHasAnyRole(user, ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "room_attendant"]);
  // Per-room extra person rate — read from board item (all hotel units are always in the board)
  const extraPersonRate = board.find((b) => b.unit.id === stay.unit_id)?.unit.extra_person_rate ?? 0;
  // Rooms available for transfer: not occupied, not needing housekeeping, not this room
  const availableRooms = board
    .filter((b) => !b.stay && !b.needsHousekeeping && b.unit.id !== stay.unit_id)
    .map((b) => ({ id: b.unit.id, unit_number: b.unit.unit_number }));
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const ordersTotal = orders.reduce((s, o) => s + o.qty * o.unit_price, 0); // includes extra person charges
  const t = stayTotals(stay, paid, ordersTotal);
  const tax = computeTax(t.total, stay.tax_mode, stay.tax_rate);

  const siteBase = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "";
  const folioData: FolioData = {
    brandName: "Sun Miles Condominium",
    roomNumber: detail.unit_number ?? stay.unit_id ?? "",
    arNo: payments[0]?.ar_no ?? null,
    guestLabel: stay.guest_label,
    checkIn: stay.check_in_at,
    checkOut: stay.check_out_at,
    plannedHours: stay.planned_hours,
    stay: {
      base_rate: stay.base_rate,
      extra_hour_rate: stay.extra_hour_rate,
      base_hours: stay.base_hours,
      planned_hours: stay.planned_hours,
      discount_amount: stay.discount_amount,
      extra_person_amount: stay.extra_person_amount,
    },
    paid,
    ordersTotal,
    discountType: stay.discount_type,
    promoName,
    promoDiscountAmount: stay.promo_discount_amount,
    extraPersons: stay.extra_persons,
    extraPersonRate,
    taxAmount: tax.tax,
    taxLabel: tax.label,
    payments: payments.map((p) => ({
      amount: p.amount,
      method: METHOD_LABEL[p.method] ?? p.method,
      ar_no: p.ar_no,
      or_no: p.receipt_no,
      created_at: p.paid_at,
    })),
    orders: foodOrders.map((o) => ({ name: o.name, qty: o.qty, unit_price: o.unit_price })),
    qrUrl: stay.portal_token ? `${siteBase}/guest/${stay.portal_token}` : null,
  };

  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between gap-3">
        <Link href="/hotel" className="text-sm font-medium text-amber-700 hover:underline">
          ← Room board
        </Link>
        <div className="flex items-center gap-3">
          <BluetoothPrintButton folioData={folioData} />
          {isConsultant && <DeleteStayButton stayId={stayId} />}
        </div>
      </div>

      {/* Guest requests from the QR bill portal */}
      {stay.status === "active" && (stay.checkout_requested || stay.extension_requested_hours != null) && (
        <div className="no-print mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {stay.checkout_requested && <p>🔔 <strong>Guest requested check-out</strong> — prepare the final bill, check the unit, and issue the gate pass.</p>}
          {stay.extension_requested_hours != null && <p>⏱️ <strong>Guest requested +{stay.extension_requested_hours}h</strong> — confirm the extension below.</p>}
        </div>
      )}

      {/* Room transfer notice */}
      {transferRecord && (
        <div className="no-print mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          {transferRecord.to_stay_id === stayId ? (
            // This is the NEW stay — guest came from another room
            <div className="space-y-1">
              <p className="font-semibold">
                🔄 Transferred from Room {transferRecord.from_unit_number}
                {transferRecord.within_10_min
                  ? " — timer was reset (within 10-minute window)"
                  : " — +5 min added to original check-in time"}
              </p>
              <p>
                <span className="font-medium">Reason:</span>{" "}
                {{ room_issue: "Room issue", maintenance: "Maintenance / repair", guest_preference: "Guest preference", other: "Other" }[transferRecord.transfer_reason] ?? transferRecord.transfer_reason}
              </p>
              {transferRecord.remarks && (
                <p><span className="font-medium">Details:</span> {transferRecord.remarks}</p>
              )}
              <p className="text-xs text-blue-700">
                By {transferRecord.performer_name ?? "staff"} · {fmtDateTime(transferRecord.transferred_at, tz)}
                {" · "}
                <Link href={`/hotel/${transferRecord.from_stay_id}`} className="underline hover:text-blue-900">
                  View original stay (Room {transferRecord.from_unit_number}) →
                </Link>
              </p>
            </div>
          ) : (
            // This is the ORIGINAL stay — guest moved out
            <div className="space-y-1">
              <p className="font-semibold">
                🔄 Guest transferred to Room {transferRecord.to_unit_number}
              </p>
              <p>
                <span className="font-medium">Reason:</span>{" "}
                {{ room_issue: "Room issue", maintenance: "Maintenance / repair", guest_preference: "Guest preference", other: "Other" }[transferRecord.transfer_reason] ?? transferRecord.transfer_reason}
              </p>
              {transferRecord.remarks && (
                <p><span className="font-medium">Details:</span> {transferRecord.remarks}</p>
              )}
              <p className="text-xs text-blue-700">
                By {transferRecord.performer_name ?? "staff"} · {fmtDateTime(transferRecord.transferred_at, tz)}
                {transferRecord.to_stay_id && (
                  <>
                    {" · "}
                    <Link href={`/hotel/${transferRecord.to_stay_id}`} className="underline hover:text-blue-900">
                      View new stay (Room {transferRecord.to_unit_number}) →
                    </Link>
                  </>
                )}
              </p>
            </div>
          )}
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
            <ExtraPersonPanel
              stayId={stay.id}
              charges={extraPersonCharges}
              extraPersonRate={extraPersonRate}
              canManage={canManageExtras}
            />
          )}
          {stay.status === "active" && (
            <OrdersPanel stayId={stay.id} orders={foodOrders} menu={menu} canWrite={canWrite} />
          )}
          {stay.status === "active" && canWrite && (
            <RoomCheck stayId={stay.id} gatepassNo={roomCheck?.gatepass_no ?? null} />
          )}
          {maintenanceIssue && (
            <MaintenanceIssuePanel issue={maintenanceIssue} canResolve={canResolveMaintenance} />
          )}
          {canWrite && <FolioActions stayId={stay.id} status={stay.status} balance={t.balance} checkInAt={stay.check_in_at} suggestedArNo={suggestedArNo} />}
          {stay.status === "active" && canWrite && (
            <TransferRoomModal
              stayId={stay.id}
              checkInAt={stay.check_in_at}
              availableRooms={availableRooms}
              currentBaseRate={stay.base_rate}
            />
          )}
          {stay.status === "active" && isSupervisor && (
            <SupervisorOpsPanel stayId={stay.id} extensions={extensions} />
          )}
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

          {/* ── Guest & room info ── */}
          <div className="mt-2 space-y-0.5">
            <Line k="Guest" v={stay.guest_label} />
            <Line k="Room" v={detail.unit_number ?? "—"} />
            {/* Transfer origin — this stay is the destination */}
            {transferRecord?.to_stay_id === stayId && (
              <>
                <Line k="Transferred from" v={`Room ${transferRecord.from_unit_number}`} />
                <Line k="Transfer time" v={fmtDateTime(transferRecord.transferred_at, tz)} />
              </>
            )}
            {/* Transfer destination — this stay was vacated */}
            {transferRecord?.from_stay_id === stayId && (
              <Line k="Transferred to" v={`Room ${transferRecord.to_unit_number} · ${fmtDateTime(transferRecord.transferred_at, tz)}`} />
            )}
            <Line k="Plan" v={detail.rate_plan_name ?? "—"} />
          </div>

          {/* ── Time breakdown ── */}
          <div className="mt-2 space-y-0.5 border-t border-dashed border-stone-300 pt-2">
            <Line k="Check-in" v={fmtDateTime(stay.check_in_at, tz)} />
            <Line k="Base hours" v={`${stay.base_hours}h`} />
            {extensions.map((ext, i) => (
              <Line key={ext.id} k={`Extension ${i + 1}`} v={`+${ext.added_hours}h  (${fmtDateTime(ext.created_at, tz)})`} />
            ))}
            {extensions.length > 0 && (
              <Line k="Total planned" v={`${stay.planned_hours}h`} />
            )}
            {stay.check_out_at ? (
              <>
                <Line k="Check-out" v={fmtDateTime(stay.check_out_at, tz)} />
                <Line k="Actual used" v={actualHoursUsed(stay.check_in_at, stay.check_out_at)} />
              </>
            ) : (
              <div className="flex justify-between text-[11px]">
                <span className="text-stone-500">Status</span>
                <span className="font-medium text-emerald-700">Active · {actualHoursUsed(stay.check_in_at, null)}</span>
              </div>
            )}
          </div>

          <div className="mt-2 space-y-0.5 border-t border-dashed border-stone-300 pt-2">
            <Line k="Room charge" v={peso(t.room_charge)} />
            {stay.extra_person_amount > 0 && (
              <Line k={`Extra persons at check-in (${stay.extra_persons}×)`} v={peso(stay.extra_person_amount)} />
            )}
            {extraPersonCharges.map((c) => (
              <Line key={c.id} k={`${c.qty}× ${c.name}`} v={peso(c.qty * c.unit_price)} />
            ))}
            {foodOrders.map((o) => (
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
                  <span className="text-stone-500 text-[11px]">
                    {label}
                    {p.payment_note && <span className="ml-1 text-[10px] text-amber-700">({p.payment_note})</span>}
                  </span>
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

function actualHoursUsed(checkIn: string, checkOut: string | null): string {
  const end = checkOut ? new Date(checkOut) : new Date();
  const totalMin = Math.max(0, Math.floor((end.getTime() - new Date(checkIn).getTime()) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
