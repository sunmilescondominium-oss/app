-- 0058_gift_cards.sql
-- Prepaid hotel hour-balance cards with pre-scheduling and public portal.

-- ---- Gift cards (the loadable card) ------------------------------------
CREATE TABLE gift_cards (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_code            text        UNIQUE NOT NULL,          -- GC-2026-001
  portal_token         text        UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  pin_hash             text        NOT NULL,                 -- SHA-256(card_code:pin)
  owner_label          text        NOT NULL,
  owner_contact        text,
  purchase_price       numeric(10,2) NOT NULL DEFAULT 0,
  total_hours          numeric(6,2)  NOT NULL,               -- hours credited at purchase
  balance_hours        numeric(6,2)  NOT NULL,               -- decrements per use
  max_hours_per_stay   int         NOT NULL DEFAULT 6,       -- cap per single check-in
  max_extension_hours  int         NOT NULL DEFAULT 2,       -- per stay
  buffer_minutes       int         NOT NULL DEFAULT 30,      -- no-show grace window
  is_active            boolean     NOT NULL DEFAULT true,
  is_loadable          boolean     NOT NULL DEFAULT true,
  expires_at           timestamptz,
  sold_by_role         text,
  notes                text,
  created_by           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ---- Load requests (patron-submitted, admin-approved) ------------------
CREATE TABLE gift_card_load_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id     uuid        NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  amount_paid      numeric(10,2) NOT NULL,
  payment_method   text        NOT NULL,
  reference_no     text,                                     -- patron's payment ref
  hours_requested  numeric(6,2) NOT NULL,                   -- hours patron expects
  status           text        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected')),
  notes            text,
  review_note      text,
  reviewed_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ---- Pre-scheduled check-ins -------------------------------------------
CREATE TABLE gift_card_reservations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id    uuid        NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  unit_id         uuid        REFERENCES units(id) ON DELETE SET NULL,
  planned_hours   int         NOT NULL DEFAULT 3,
  scheduled_at    timestamptz NOT NULL,
  buffer_minutes  int         NOT NULL DEFAULT 30,
  status          text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','checked_in','no_show','cancelled')),
  notes           text,
  stay_id         uuid        REFERENCES stays(id) ON DELETE SET NULL,
  no_show_at      timestamptz,
  checked_in_at   timestamptz,
  cancelled_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---- Transaction ledger (all debits and credits) -----------------------
CREATE TABLE gift_card_transactions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id     uuid        NOT NULL REFERENCES gift_cards(id) ON DELETE CASCADE,
  stay_id          uuid        REFERENCES stays(id) ON DELETE SET NULL,
  reservation_id   uuid        REFERENCES gift_card_reservations(id) ON DELETE SET NULL,
  load_request_id  uuid        REFERENCES gift_card_load_requests(id) ON DELETE SET NULL,
  type             text        NOT NULL
                     CHECK (type IN ('sale','checkin','extension','load','no_show','void','adjustment')),
  hours            numeric(6,2) NOT NULL,    -- positive = credit, negative = debit
  balance_after    numeric(6,2) NOT NULL,
  amount_paid      numeric(10,2),
  payment_method   text,
  notes            text,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ---- Link stays to gift cards ------------------------------------------
ALTER TABLE stays
  ADD COLUMN gift_card_id             uuid REFERENCES gift_cards(id) ON DELETE SET NULL,
  ADD COLUMN gift_card_reservation_id uuid REFERENCES gift_card_reservations(id) ON DELETE SET NULL;

-- ---- Indexes -----------------------------------------------------------
CREATE INDEX ON gift_cards (card_code);
CREATE INDEX ON gift_cards (portal_token);
CREATE INDEX ON gift_card_reservations (gift_card_id);
CREATE INDEX ON gift_card_reservations (scheduled_at) WHERE status = 'pending';
CREATE INDEX ON gift_card_transactions (gift_card_id, created_at DESC);
CREATE INDEX ON gift_card_load_requests (gift_card_id);
CREATE INDEX ON gift_card_load_requests (status) WHERE status = 'pending';

-- ---- RLS (service-role used from app; public portal reads by token) ----
ALTER TABLE gift_cards              ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_reservations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_card_load_requests ENABLE ROW LEVEL SECURITY;

-- Allow all operations (app-level auth via admin client)
CREATE POLICY "svc gift_cards"              ON gift_cards              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc gift_card_transactions"  ON gift_card_transactions  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc gift_card_reservations"  ON gift_card_reservations  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "svc gift_card_load_requests" ON gift_card_load_requests FOR ALL USING (true) WITH CHECK (true);
