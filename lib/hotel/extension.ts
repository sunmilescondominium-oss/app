import { roomCharge } from "./rates";

/** Grace period (minutes) before extension billing kicks in. */
export const CHECKOUT_GRACE_MIN = 15;

export interface ExtensionDetail {
  stayId: string;
  unitNumber: string;
  guestLabel: string;
  checkInAt: string;
  checkOutAt: string;
  plannedHours: number;
  extHours: number;
  extRate: number;
  extAmount: number;
  baseAmount: number;    // room charge for planned hours minus discount
  totalExpected: number; // baseAmount + extAmount
}

export function computeExtension(stay: {
  id: string;
  guest_label: string;
  check_in_at: string;
  check_out_at: string | null;
  planned_hours: number;
  base_hours: number;
  base_rate: number;
  extra_hour_rate: number;
  discount_amount: number;
}, unitNumber: string): ExtensionDetail | null {
  if (!stay.check_out_at) return null;

  const checkInMs  = new Date(stay.check_in_at).getTime();
  const checkOutMs = new Date(stay.check_out_at).getTime();
  const plannedEndMs = checkInMs + stay.planned_hours * 60 * 60 * 1000;
  const graceEndMs   = plannedEndMs + CHECKOUT_GRACE_MIN * 60 * 1000;

  const extHours = checkOutMs > graceEndMs
    ? Math.ceil((checkOutMs - plannedEndMs - CHECKOUT_GRACE_MIN * 60 * 1000) / (60 * 60 * 1000))
    : 0;

  const rc        = roomCharge(stay.base_rate, stay.extra_hour_rate, stay.base_hours, stay.planned_hours);
  const baseAmount = Math.max(0, Math.round((rc - stay.discount_amount) * 100) / 100);
  const extAmount  = Math.round(extHours * stay.extra_hour_rate * 100) / 100;

  return {
    stayId: stay.id,
    unitNumber,
    guestLabel: stay.guest_label,
    checkInAt: stay.check_in_at,
    checkOutAt: stay.check_out_at,
    plannedHours: stay.planned_hours,
    extHours,
    extRate: stay.extra_hour_rate,
    extAmount,
    baseAmount,
    totalExpected: Math.round((baseAmount + extAmount) * 100) / 100,
  };
}
