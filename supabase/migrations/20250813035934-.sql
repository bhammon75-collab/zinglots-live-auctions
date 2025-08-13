-- Retry: Seller-Fulfilled Shipping and Live Streaming Migration (idempotent)
-- 1) Create shipping_status enum in app schema if it does not exist
DO $$
BEGIN
  BEGIN
    CREATE TYPE app.shipping_status AS ENUM (
      'awaiting_shipment','shipped','delivered','returned','lost'
    );
  EXCEPTION
    WHEN duplicate_object THEN
      -- type already exists, ignore
      NULL;
  END;
END$$;

-- 2) Orders: add shipping policy snapshot + payout/fulfillment tracking fields
ALTER TABLE app.orders
  ADD COLUMN IF NOT EXISTS shipping_flat_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_flat_cents >= 0),
  ADD COLUMN IF NOT EXISTS handling_days INTEGER NOT NULL DEFAULT 2 CHECK (handling_days BETWEEN 0 AND 30),
  ADD COLUMN IF NOT EXISTS fee_applies_to_shipping BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS payout_hold_days INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS ship_by_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- Trigger to compute ship_by_at when paid_at becomes non-null
CREATE OR REPLACE FUNCTION app.set_ship_by_after_payment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.paid_at IS NOT NULL AND (OLD.paid_at IS DISTINCT FROM NEW.paid_at) THEN
    NEW.ship_by_at := NEW.paid_at + make_interval(days => GREATEST(COALESCE(NEW.handling_days, 0), 0));
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_orders_set_ship_by ON app.orders;
CREATE TRIGGER trg_orders_set_ship_by
BEFORE UPDATE ON app.orders
FOR EACH ROW
WHEN (NEW.paid_at IS NOT NULL AND OLD.paid_at IS DISTINCT FROM NEW.paid_at)
EXECUTE FUNCTION app.set_ship_by_after_payment();

-- 3) Private PII storage for shipping destination
CREATE TABLE IF NOT EXISTS app.orders_private (
  order_id UUID PRIMARY KEY REFERENCES app.orders(id) ON DELETE CASCADE,
  ship_to JSONB NOT NULL
);

-- 4) Shipments table (MVP 1:1 with order)
CREATE TABLE IF NOT EXISTS app.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES app.orders(id) ON DELETE CASCADE,
  status app.shipping_status NOT NULL DEFAULT 'awaiting_shipment',
  carrier TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipments_order_id_idx ON app.shipments(order_id);

-- 5) Enable RLS and policies
ALTER TABLE app.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.orders_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_buyer_seller_select ON app.orders;
CREATE POLICY orders_buyer_seller_select ON app.orders
FOR SELECT USING (
  auth.uid() = buyer_id OR auth.uid() = seller_id OR
  EXISTS(SELECT 1 FROM app.profiles p WHERE p.id = auth.uid() AND COALESCE(p.is_admin,false))
);

DROP POLICY IF EXISTS orders_private_buyer_seller_select ON app.orders_private;
CREATE POLICY orders_private_buyer_seller_select ON app.orders_private
FOR SELECT USING (
  EXISTS(SELECT 1 FROM app.orders o WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid()))
  OR EXISTS(SELECT 1 FROM app.profiles p WHERE p.id = auth.uid() AND COALESCE(p.is_admin,false))
);

DROP POLICY IF EXISTS shipments_buyer_seller_rw ON app.shipments;
CREATE POLICY shipments_buyer_seller_rw ON app.shipments
FOR ALL USING (
  EXISTS(SELECT 1 FROM app.orders o WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid()))
  OR EXISTS(SELECT 1 FROM app.profiles p WHERE p.id = auth.uid() AND COALESCE(p.is_admin,false))
)
WITH CHECK (
  EXISTS(SELECT 1 FROM app.orders o WHERE o.id = order_id AND o.seller_id = auth.uid())
  OR EXISTS(SELECT 1 FROM app.profiles p WHERE p.id = auth.uid() AND COALESCE(p.is_admin,false))
);

-- 6) Live streaming fields on shows
ALTER TABLE app.shows
  ADD COLUMN IF NOT EXISTS rtmp_destinations JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS player_pref TEXT DEFAULT 'livekit' CHECK (player_pref IN ('livekit','facebook')),
  ADD COLUMN IF NOT EXISTS fb_video_id TEXT,
  ADD COLUMN IF NOT EXISTS go_live_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_live_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS peak_concurrent INTEGER DEFAULT 0;