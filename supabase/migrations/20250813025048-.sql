-- Create orders_private table then RLS policy
CREATE TABLE IF NOT EXISTS app.orders_private (
  order_id uuid PRIMARY KEY REFERENCES app.orders(id) ON DELETE CASCADE,
  ship_to jsonb NOT NULL
);

ALTER TABLE app.orders_private ENABLE ROW LEVEL SECURITY;

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
