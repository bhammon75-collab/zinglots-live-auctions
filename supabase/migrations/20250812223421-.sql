-- Complete schema updates excluding place_bid (already updated)

-- Ensure schema
create schema if not exists app;

-- Enums (safe)
DO $$ BEGIN
  CREATE TYPE app.verification_tier AS ENUM ('tier0','tier1','tier2');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE app.escrow_status AS ENUM ('none','held','released','disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles
ALTER TABLE app.profiles
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_tier app.verification_tier NOT NULL DEFAULT 'tier0',
  ADD COLUMN IF NOT EXISTS address jsonb,
  ADD COLUMN IF NOT EXISTS payment_method_confirmed boolean NOT NULL DEFAULT false;

-- Lots
ALTER TABLE app.lots
  ADD COLUMN IF NOT EXISTS reserve_price numeric,
  ADD COLUMN IF NOT EXISTS reserve_met boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_price numeric,
  ADD COLUMN IF NOT EXISTS anti_snipe_extensions_used int NOT NULL DEFAULT 0;

-- Bids
ALTER TABLE app.bids
  ADD COLUMN IF NOT EXISTS is_proxy boolean NOT NULL DEFAULT false;

-- Proxy bids
CREATE TABLE IF NOT EXISTS app.proxy_bids (
  lot_id uuid NOT NULL REFERENCES app.lots(id) ON DELETE CASCADE,
  bidder_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE CASCADE,
  max_amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lot_id, bidder_id)
);
ALTER TABLE app.proxy_bids ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY proxy_bids_public_read ON app.proxy_bids FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY proxy_bids_upsert_owner ON app.proxy_bids FOR INSERT WITH CHECK (bidder_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY proxy_bids_update_owner ON app.proxy_bids FOR UPDATE USING (bidder_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Bundles
CREATE TABLE IF NOT EXISTS app.bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES app.shows(id) ON DELETE CASCADE,
  title text NOT NULL,
  discount_percent numeric NOT NULL DEFAULT 0.10,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.bundles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY bundles_public_read ON app.bundles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bundles_owner_write ON app.bundles FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM app.shows sh WHERE sh.id = show_id AND (sh.seller_id = auth.uid() OR app.is_admin()))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bundles_owner_update ON app.bundles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM app.shows sh WHERE sh.id = show_id AND (sh.seller_id = auth.uid() OR app.is_admin()))
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS app.bundle_items (
  bundle_id uuid NOT NULL REFERENCES app.bundles(id) ON DELETE CASCADE,
  lot_id uuid NOT NULL REFERENCES app.lots(id) ON DELETE CASCADE,
  PRIMARY KEY (bundle_id, lot_id)
);
ALTER TABLE app.bundle_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY bundle_items_public_read ON app.bundle_items FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bundle_items_owner_write ON app.bundle_items FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.bundles b JOIN app.shows sh ON sh.id = b.show_id
      WHERE b.id = bundle_id AND (sh.seller_id = auth.uid() OR app.is_admin())
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS app.bundle_bids (
  id bigserial PRIMARY KEY,
  bundle_id uuid NOT NULL REFERENCES app.bundles(id) ON DELETE CASCADE,
  bidder_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  is_proxy boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.bundle_bids ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY bundle_bids_public_read ON app.bundle_bids FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bundle_bids_insert_auth ON app.bundle_bids FOR INSERT WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS app.bundle_proxy_bids (
  bundle_id uuid NOT NULL REFERENCES app.bundles(id) ON DELETE CASCADE,
  bidder_id uuid NOT NULL REFERENCES app.profiles(id) ON DELETE CASCADE,
  max_amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bundle_id, bidder_id)
);
ALTER TABLE app.bundle_proxy_bids ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY bundle_proxy_bids_public_read ON app.bundle_proxy_bids FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bundle_proxy_bids_upsert_owner ON app.bundle_proxy_bids FOR INSERT WITH CHECK (bidder_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY bundle_proxy_bids_update_owner ON app.bundle_proxy_bids FOR UPDATE USING (bidder_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Orders: escrow fields
ALTER TABLE app.orders
  ADD COLUMN IF NOT EXISTS escrow_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escrow_status app.escrow_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS delivery_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_window_days int NOT NULL DEFAULT 3;

-- Helpers
CREATE OR REPLACE FUNCTION app.bid_increment_for(p_amount numeric)
RETURNS numeric AS $$
BEGIN
  IF p_amount < 100 THEN RETURN 5; END IF;
  IF p_amount < 500 THEN RETURN 10; END IF;
  IF p_amount < 1000 THEN RETURN 25; END IF;
  IF p_amount < 5000 THEN RETURN 50; END IF;
  IF p_amount < 10000 THEN RETURN 100; END IF;
  RETURN 250;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION app.bid_cap_for_tier(p_tier app.verification_tier)
RETURNS numeric AS $$
BEGIN
  IF p_tier = 'tier0' THEN RETURN 200; END IF;
  IF p_tier = 'tier1' THEN RETURN 1000; END IF;
  RETURN 1000000000;
END;
$$ LANGUAGE plpgsql STABLE;

-- Bid history view
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

-- Realtime image
ALTER TABLE app.bids REPLICA IDENTITY FULL;