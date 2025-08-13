-- Seller-Fulfilled Shipping + Live Streaming base schema

-- 1) Create shipping_status enum (safe if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'shipping_status' AND n.nspname = 'app'
  ) THEN
    CREATE TYPE app.shipping_status AS ENUM (
      'awaiting_shipment','shipped','delivered','returned','lost'
    );
  END IF;
END$$;

-- 2) Orders: shipping snapshot + payout gates (add columns if not exists)
ALTER TABLE app.orders
  ADD COLUMN IF NOT EXISTS shipping_flat_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS handling_days integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS fee_applies_to_shipping boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payout_hold_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS ship_by_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- keep constraints simple and compatible
DO $$
BEGIN
  -- handling_days between 0 and 30
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_handling_days_range_check'
  ) THEN
    ALTER TABLE app.orders
      ADD CONSTRAINT orders_handling_days_range_check CHECK (handling_days >= 0 AND handling_days <= 30);
  END IF;
  -- shipping_flat_cents >= 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_shipping_flat_nonneg_check'
  ) THEN
    ALTER TABLE app.orders
      ADD CONSTRAINT orders_shipping_flat_nonneg_check CHECK (shipping_flat_cents >= 0);
  END IF;
END$$;

-- 3) Trigger to set ship_by_at after paid_at changes
CREATE OR REPLACE FUNCTION app.set_ship_by_after_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.paid_at IS NOT NULL AND (OLD.paid_at IS DISTINCT FROM NEW.paid_at) THEN
    NEW.ship_by_at := NEW.paid_at + make_interval(days => GREATEST(COALESCE(NEW.handling_days, 0), 0));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_set_ship_by ON app.orders;
CREATE TRIGGER trg_orders_set_ship_by
BEFORE UPDATE ON app.orders
FOR EACH ROW
WHEN (NEW.paid_at IS NOT NULL AND (OLD.paid_at IS DISTINCT FROM NEW.paid_at))
EXECUTE FUNCTION app.set_ship_by_after_payment();

-- 4) Shipments table (1:1 MVP but flexible)
CREATE TABLE IF NOT EXISTS app.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES app.orders(id) ON DELETE CASCADE,
  status app.shipping_status NOT NULL DEFAULT 'awaiting_shipment',
  carrier text,
  tracking_number text,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipments_order_id_idx ON app.shipments(order_id);

-- 5) Enable RLS (idempotent)
ALTER TABLE app.shipments ENABLE ROW LEVEL SECURITY;

-- Access: buyer and seller can read; only seller can write
DROP POLICY IF EXISTS shipments_read ON app.shipments;
CREATE POLICY shipments_read ON app.shipments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM app.orders o
    WHERE o.id = app.shipments.order_id
      AND (
        o.buyer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM app.lots l
          JOIN app.shows s ON s.id = l.show_id
          WHERE l.id = o.lot_id AND s.seller_id = auth.uid()
        )
      )
  )
);

DROP POLICY IF EXISTS shipments_insert ON app.shipments;
CREATE POLICY shipments_insert ON app.shipments
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM app.orders o
    WHERE o.id = order_id
      AND EXISTS (
        SELECT 1 FROM app.lots l
        JOIN app.shows s ON s.id = l.show_id
        WHERE l.id = o.lot_id AND s.seller_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS shipments_update ON app.shipments;
CREATE POLICY shipments_update ON app.shipments
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM app.orders o
    WHERE o.id = order_id
      AND EXISTS (
        SELECT 1 FROM app.lots l
        JOIN app.shows s ON s.id = l.show_id
        WHERE l.id = o.lot_id AND s.seller_id = auth.uid()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM app.orders o
    WHERE o.id = order_id
      AND EXISTS (
        SELECT 1 FROM app.lots l
        JOIN app.shows s ON s.id = l.show_id
        WHERE l.id = o.lot_id AND s.seller_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS shipments_delete ON app.shipments;
CREATE POLICY shipments_delete ON app.shipments
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM app.orders o
    WHERE o.id = order_id
      AND EXISTS (
        SELECT 1 FROM app.lots l
        JOIN app.shows s ON s.id = l.show_id
        WHERE l.id = o.lot_id AND s.seller_id = auth.uid()
      )
  )
);

-- 6) Live streaming fields on shows
ALTER TABLE app.shows
  ADD COLUMN IF NOT EXISTS rtmp_destinations jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS player_pref text DEFAULT 'livekit',
  ADD COLUMN IF NOT EXISTS fb_video_id text,
  ADD COLUMN IF NOT EXISTS go_live_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_live_at timestamptz,
  ADD COLUMN IF NOT EXISTS peak_concurrent integer DEFAULT 0;

-- Optional: simple constraint for player_pref values (idempotent via name guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shows_player_pref_allowed_check'
  ) THEN
    ALTER TABLE app.shows
      ADD CONSTRAINT shows_player_pref_allowed_check CHECK (player_pref IN ('livekit','facebook'));
  END IF;
END$$;
