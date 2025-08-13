-- Recreate RLS policies without EXECUTE
DROP POLICY IF EXISTS orders_buyer_seller_select ON app.orders;
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

DROP POLICY IF EXISTS orders_private_buyer_seller_select ON app.orders_private;
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

DROP POLICY IF EXISTS shipments_buyer_seller_rw ON app.shipments;
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
