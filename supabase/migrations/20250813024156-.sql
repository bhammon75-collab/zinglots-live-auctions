-- Seller-fulfilled shipping migration
-- 1) Create shipping_status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'shipping_status' AND n.nspname = 'app') THEN
    EXECUTE $$CREATE TYPE app.shipping_status AS ENUM (
      'awaiting_shipment', 'shipped', 'delivered', 'returned', 'lost'
    )$$;
  END IF;
END$$;

-- 2) Extend lots with shipping policy fields
ALTER TABLE app.lots
  ADD COLUMN IF NOT EXISTS shipping_policy text NOT NULL DEFAULT 'flat' CHECK (shipping_policy IN ('flat','free','pickup')),
  ADD COLUMN IF NOT EXISTS shipping_flat_cents integer NOT NULL DEFAULT 0 CHECK (shipping_flat_cents >= 0),
  ADD COLUMN IF NOT EXISTS handling_days integer NOT NULL DEFAULT 2 CHECK (handling_days BETWEEN 0 AND 30),
  ADD COLUMN IF NOT EXISTS fee_applies_to_shipping boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ship_from_address jsonb;

-- 3) Extend orders with snapshot fields and timestamps
ALTER TABLE app.orders
  ADD COLUMN IF NOT EXISTS shipping_policy text NOT NULL DEFAULT 'flat' CHECK (shipping_policy IN ('flat','free','pickup')),
  ADD COLUMN IF NOT EXISTS shipping_flat_cents integer NOT NULL DEFAULT 0 CHECK (shipping_flat_cents >= 0),
  ADD COLUMN IF NOT EXISTS handling_days integer NOT NULL DEFAULT 2 CHECK (handling_days BETWEEN 0 AND 30),
  ADD COLUMN IF NOT EXISTS fee_applies_to_shipping boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payout_hold_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS ship_by_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- 4) Function + trigger to compute ship_by_at after payment
CREATE OR REPLACE FUNCTION app.set_ship_by_after_payment()
RETURNS trigger LANGUAGE plpgsql AS $$
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

-- 5) Private PII for shipping destination
CREATE TABLE IF NOT EXISTS app.orders_private (
  order_id uuid PRIMARY KEY REFERENCES app.orders(id) ON DELETE CASCADE,
  ship_to jsonb NOT NULL
);

-- 6) Shipments table (1:1 with orders for MVP)
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

-- Ensure touch_updated_at exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'touch_updated_at' AND n.nspname = 'app'
  ) THEN
    EXECUTE $$CREATE OR REPLACE FUNCTION app.touch_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $$$$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END$$$$$$;
  END IF;
END$$;

DROP TRIGGER IF EXISTS trg_shipments_updated_at ON app.shipments;
CREATE TRIGGER trg_shipments_updated_at
BEFORE UPDATE ON app.shipments
FOR EACH ROW EXECUTE PROCEDURE app.touch_updated_at();

-- 7) Enable RLS and policies
ALTER TABLE app.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.orders_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.shipments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- orders select policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = 'orders' AND policyname = 'orders_buyer_seller_select'
  ) THEN
    EXECUTE $$CREATE POLICY orders_buyer_seller_select ON app.orders
      FOR SELECT USING (
        auth.uid() = buyer_id OR auth.uid() = seller_id OR app.is_admin()
      )$$;
  END IF;

  -- orders_private select policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = 'orders_private' AND policyname = 'orders_private_buyer_seller_select'
  ) THEN
    EXECUTE $$CREATE POLICY orders_private_buyer_seller_select ON app.orders_private
      FOR SELECT USING (
        EXISTS(SELECT 1 FROM app.orders o WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())) OR app.is_admin()
      )$$;
  END IF;

  -- shipments read/write with seller write restriction
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = 'shipments' AND policyname = 'shipments_buyer_seller_rw'
  ) THEN
    EXECUTE $$CREATE POLICY shipments_buyer_seller_rw ON app.shipments
      FOR ALL USING (
        EXISTS(SELECT 1 FROM app.orders o WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())) OR app.is_admin()
      ) WITH CHECK (
        EXISTS(SELECT 1 FROM app.orders o WHERE o.id = order_id AND o.seller_id = auth.uid()) OR app.is_admin()
      )$$;
  END IF;
END$$;

-- 8) Helpful indexes for operations
CREATE INDEX IF NOT EXISTS orders_ship_by_at_idx ON app.orders(ship_by_at) WHERE shipped_at IS NULL AND paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_needs_payout_idx ON app.orders(shipped_at, delivered_at, paid_at) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_shipping_policy_idx ON app.orders(shipping_policy);

-- 9) Backfill defaults for existing orders
UPDATE app.orders SET
  shipping_flat_cents = COALESCE(shipping_flat_cents, 0),
  handling_days = COALESCE(handling_days, 2),
  fee_applies_to_shipping = COALESCE(fee_applies_to_shipping, true),
  payout_hold_days = COALESCE(payout_hold_days, 7),
  shipping_policy = COALESCE(shipping_policy, 'free')
WHERE TRUE;

-- Create shipment records where appropriate (best-effort)
INSERT INTO app.shipments (order_id, status, shipped_at, delivered_at)
SELECT o.id,
       CASE WHEN o.delivered_at IS NOT NULL THEN 'delivered'::app.shipping_status ELSE 'shipped'::app.shipping_status END,
       COALESCE(o.shipped_at, o.paid_at),
       o.delivered_at
FROM app.orders o
WHERE o.paid_at IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM app.shipments s WHERE s.order_id = o.id);
