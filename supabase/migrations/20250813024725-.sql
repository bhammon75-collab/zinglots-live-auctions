-- Ensure orders_private and shipments exist, then apply RLS policies
-- Create orders_private if missing
CREATE TABLE IF NOT EXISTS app.orders_private (
  order_id uuid PRIMARY KEY REFERENCES app.orders(id) ON DELETE CASCADE,
  ship_to jsonb NOT NULL
);

-- Create shipments if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='app' AND table_name='shipments'
  ) THEN
    CREATE TABLE app.shipments (
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
    CREATE INDEX shipments_order_id_idx ON app.shipments(order_id);
  END IF;
END$$;

-- Enable RLS
ALTER TABLE app.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.orders_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.shipments ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies with correct joins
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='app' AND tablename='orders' AND policyname='orders_buyer_seller_select') THEN
    EXECUTE 'DROP POLICY orders_buyer_seller_select ON app.orders';
  END IF;
  EXECUTE $$CREATE POLICY orders_buyer_seller_select ON app.orders
  FOR SELECT USING (
    auth.uid() = buyer_id
    OR EXISTS (
      SELECT 1 FROM app.lots l
      JOIN app.shows s ON s.id = l.show_id
      WHERE l.id = app.orders.lot_id AND s.seller_id = auth.uid()
    )
    OR app.is_admin()
  )$$;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='app' AND tablename='orders_private' AND policyname='orders_private_buyer_seller_select') THEN
    EXECUTE 'DROP POLICY orders_private_buyer_seller_select ON app.orders_private';
  END IF;
  EXECUTE $$CREATE POLICY orders_private_buyer_seller_select ON app.orders_private
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM app.orders o
      WHERE o.id = order_id AND (
        o.buyer_id = auth.uid() OR EXISTS (
          SELECT 1 FROM app.lots l JOIN app.shows s ON s.id = l.show_id
          WHERE l.id = o.lot_id AND s.seller_id = auth.uid()
        )
      )
    )
    OR app.is_admin()
  )$$;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='app' AND tablename='shipments' AND policyname='shipments_buyer_seller_rw') THEN
    EXECUTE 'DROP POLICY shipments_buyer_seller_rw ON app.shipments';
  END IF;
  EXECUTE $$CREATE POLICY shipments_buyer_seller_rw ON app.shipments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM app.orders o
      WHERE o.id = order_id AND (
        o.buyer_id = auth.uid() OR EXISTS (
          SELECT 1 FROM app.lots l JOIN app.shows s ON s.id = l.show_id
          WHERE l.id = o.lot_id AND s.seller_id = auth.uid()
        )
      )
    )
    OR app.is_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.orders o
      WHERE o.id = order_id AND EXISTS (
        SELECT 1 FROM app.lots l JOIN app.shows s ON s.id = l.show_id
        WHERE l.id = o.lot_id AND s.seller_id = auth.uid()
      )
    )
    OR app.is_admin()
  )$$;
END$$;
