export interface RatePlan {
  id: string;
  name: string;
  base_hours: number;
  base_rate: number;
  extra_hour_rate: number;
  sort_order: number;
  is_active: boolean;
}

export interface Promo {
  id: string;
  name: string;
  disc_type: string;
  disc_value: number;
  is_active: boolean;
}

export interface Stay {
  id: string;
  unit_id: string | null;
  guest_label: string;
  guest_contact: string | null;
  rate_plan_id: string | null;
  planned_hours: number;
  base_hours: number;
  base_rate: number;
  extra_hour_rate: number;
  promo_id: string | null;
  discount_amount: number;
  tax_mode: string;
  tax_rate: number;
  check_in_at: string;
  check_out_at: string | null;
  status: string;
  unit?: { unit_number: string } | null;
  rate_plan_name?: string | null;
}

export interface StayPayment {
  id: string;
  stay_id: string;
  method: string;
  amount: number;
  receipt_no: string | null;
  paid_at: string;
}

export interface MenuItem {
  id: string;
  category: string;
  name: string;
  price: number;
  sort_order: number;
  is_active: boolean;
}

export interface StayOrder {
  id: string;
  stay_id: string;
  menu_item_id: string | null;
  name: string;
  qty: number;
  unit_price: number;
}

export interface RoomBoardItem {
  unit: { id: string; unit_number: string; unit_type: string | null };
  stay: Stay | null;
  /** Room was used and still has an open housekeeping task — not yet vacant. */
  needsHousekeeping: boolean;
}

export interface StayDetail {
  stay: Stay;
  payments: StayPayment[];
  orders: StayOrder[];
  unit_number: string | null;
  rate_plan_name: string | null;
}

export interface TaxSetting {
  tax_mode: string;
  tax_rate: number;
}

export interface RoomTaxRow {
  unit_id: string;
  unit_number?: string;
  tax_mode: string;
  tax_rate: number;
}

export interface HotelDaySummary {
  date: string;
  checkInCount: number;
  checkOutCount: number;
  checkIns: { unit: string; guest: string; at: string }[];
  checkOuts: { unit: string; guest: string; at: string; hours: number }[];
  totalOccupiedHours: number;
  collectionsTotal: number;
  paymentCount: number;
  byMethod: { method: string; total: number }[];
}
