-- Fix RLS policies to use lot->show seller linkage
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='app' AND tablename='orders' AND policyname='orders_buyer_seller_select') THEN
    EXECUTE 'DROP POLICY orders_buyer_seller_select ON app.orders';
  END IF;

  CREATE POLICY orders_buyer_seller_select ON app.orders
  FOR SELECT USING (
    auth.uid() = buyer_id
    OR EXISTS (
      SELECT 1 FROM app.lots l
      JOIN app.shows s ON s.id = l.show_id
      WHERE l.id = app.orders.lot_id AND s.seller_id = auth.uid()
    )
    OR app.is_admin()
  );

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='app' AND tablename='orders_private' AND policyname='orders_private_buyer_seller_select') THEN
    EXECUTE 'DROP POLICY orders_private_buyer_seller_select ON app.orders_private';
  END IF;

  CREATE POLICY orders_private_buyer_seller_select ON app.orders_private
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
  );

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='app' AND tablename='shipments' AND policyname='shipments_buyer_seller_rw') THEN
    EXECUTE 'DROP POLICY shipments_buyer_seller_rw ON app.shipments';
  END IF;

  CREATE POLICY shipments_buyer_seller_rw ON app.shipments
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
  );
END$$;
