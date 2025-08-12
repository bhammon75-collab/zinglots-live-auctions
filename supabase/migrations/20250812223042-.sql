-- Fixing policies without IF NOT EXISTS and stabilizing bid_history view

-- 1) Ensure RLS enabled on new tables (if not already)
alter table app.proxy_bids enable row level security;
alter table app.bundles enable row level security;
alter table app.bundle_items enable row level security;
alter table app.bundle_bids enable row level security;
alter table app.bundle_proxy_bids enable row level security;

-- 2) Create policies using DO blocks to avoid duplicate errors

-- proxy_bids policies
DO $$ BEGIN
  CREATE POLICY proxy_bids_public_read ON app.proxy_bids FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY proxy_bids_upsert_owner ON app.proxy_bids FOR INSERT WITH CHECK (bidder_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY proxy_bids_update_owner ON app.proxy_bids FOR UPDATE USING (bidder_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- bundles policies
DO $$ BEGIN
  CREATE POLICY bundles_public_read ON app.bundles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bundles_owner_write ON app.bundles FOR INSERT WITH CHECK (
    exists (select 1 from app.shows sh where sh.id = show_id and (sh.seller_id = auth.uid() or app.is_admin()))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bundles_owner_update ON app.bundles FOR UPDATE USING (
    exists (select 1 from app.shows sh where sh.id = show_id and (sh.seller_id = auth.uid() or app.is_admin()))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- bundle_items policies
DO $$ BEGIN
  CREATE POLICY bundle_items_public_read ON app.bundle_items FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bundle_items_owner_write ON app.bundle_items FOR INSERT WITH CHECK (
    exists (
      select 1 from app.bundles b join app.shows sh on sh.id = b.show_id
      where b.id = bundle_id and (sh.seller_id = auth.uid() or app.is_admin())
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- bundle_bids policies
DO $$ BEGIN
  CREATE POLICY bundle_bids_public_read ON app.bundle_bids FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bundle_bids_insert_auth ON app.bundle_bids FOR INSERT WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- bundle_proxy_bids policies
DO $$ BEGIN
  CREATE POLICY bundle_proxy_bids_public_read ON app.bundle_proxy_bids FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bundle_proxy_bids_upsert_owner ON app.bundle_proxy_bids FOR INSERT WITH CHECK (bidder_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bundle_proxy_bids_update_owner ON app.bundle_proxy_bids FOR UPDATE USING (bidder_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Re-create bid_history view in a stable way
DROP VIEW IF EXISTS app.bid_history;
CREATE VIEW app.bid_history AS
WITH firsts AS (
  SELECT lot_id, bidder_id, MIN(created_at) AS first_time
  FROM app.bids
  GROUP BY lot_id, bidder_id
)
SELECT
  b.lot_id,
  b.created_at,
  CONCAT('Bidder', lpad(DENSE_RANK() OVER (PARTITION BY b.lot_id ORDER BY f.first_time)::text, 3, '0')) AS bidder_alias,
  b.amount,
  b.is_proxy
FROM app.bids b
JOIN firsts f ON f.lot_id = b.lot_id AND f.bidder_id = b.bidder_id;