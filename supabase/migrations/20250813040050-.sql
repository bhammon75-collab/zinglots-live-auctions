-- Fix shipments policy to use app.is_admin() helper
DROP POLICY IF EXISTS shipments_buyer_seller_rw ON app.shipments;
CREATE POLICY shipments_buyer_seller_rw ON app.shipments
FOR ALL USING (
  EXISTS(
    SELECT 1 FROM app.orders o
    JOIN app.lots l ON l.id = o.lot_id
    JOIN app.shows sh ON sh.id = l.show_id
    WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR sh.seller_id = auth.uid())
  )
  OR app.is_admin()
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM app.orders o
    JOIN app.lots l ON l.id = o.lot_id
    JOIN app.shows sh ON sh.id = l.show_id
    WHERE o.id = order_id AND sh.seller_id = auth.uid()
  )
  OR app.is_admin()
);