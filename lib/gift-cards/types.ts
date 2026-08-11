export interface GiftCard {
  id: string;
  card_code: string;
  portal_token: string;
  owner_label: string;
  owner_contact: string | null;
  purchase_price: number;
  total_hours: number;
  balance_hours: number;
  max_hours_per_stay: number;
  max_extension_hours: number;
  buffer_minutes: number;
  is_active: boolean;
  is_loadable: boolean;
  expires_at: string | null;
  sold_by_role: string | null;
  notes: string | null;
  created_at: string;
}

export interface GiftCardTransaction {
  id: string;
  gift_card_id: string;
  stay_id: string | null;
  reservation_id: string | null;
  load_request_id: string | null;
  type: "sale" | "checkin" | "extension" | "load" | "no_show" | "void" | "adjustment";
  hours: number;
  balance_after: number;
  amount_paid: number | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

export interface GiftCardReservation {
  id: string;
  gift_card_id: string;
  unit_id: string | null;
  planned_hours: number;
  scheduled_at: string;
  buffer_minutes: number;
  status: "pending" | "checked_in" | "no_show" | "cancelled";
  notes: string | null;
  stay_id: string | null;
  no_show_at: string | null;
  checked_in_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  // joined
  unit_number?: string | null;
  card_code?: string;
  owner_label?: string;
}

export interface GiftCardLoadRequest {
  id: string;
  gift_card_id: string;
  amount_paid: number;
  payment_method: string;
  reference_no: string | null;
  hours_requested: number;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface GiftCardDetail extends GiftCard {
  transactions: GiftCardTransaction[];
  reservations: GiftCardReservation[];
  load_requests: GiftCardLoadRequest[];
}
