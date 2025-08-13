-- Fix shipments policy to reference seller via lots->shows
DROP POLICY IF EXISTS shipments_buyer_seller_rw ON app.shipments;
CREATE POLICY shipments_buyer_seller_rw ON app.shipments
FOR ALL USING (
  EXISTS(
    SELECT 1 FROM app.orders o
    JOIN app.lots l ON l.id = o.lot_id
    JOIN app.shows sh ON sh.id = l.show_id
    WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR sh.seller_id = auth.uid())
  )
  OR EXISTS(SELECT 1 FROM app.profiles p WHERE p.id = auth.uid() AND COALESCE(p.is_admin,false))
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM app.orders o
    JOIN app.lots l ON l.id = o.lot_id
    JOIN app.shows sh ON sh.id = l.show_id
    WHERE o.id = order_id AND sh.seller_id = auth.uid()
  )
  OR EXISTS(SELECT 1 FROM app.profiles p WHERE p.id = auth.uid() AND COALESCE(p.is_admin,false))
);