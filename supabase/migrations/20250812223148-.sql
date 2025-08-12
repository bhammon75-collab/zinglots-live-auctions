-- Full idempotent migration for proxy bidding, bundling, reserve, increments, anti-snipe,
-- verification tiers, escrow fields, and bid history (schema: app)

-- 0) Ensure schema
create schema if not exists app;

-- 1) Enums (safe create)
DO $$ BEGIN
  CREATE TYPE app.verification_tier AS ENUM ('tier0','tier1','tier2');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE app.escrow_status AS ENUM ('none','held','released','disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Profiles: verification fields
ALTER TABLE app.profiles
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_tier app.verification_tier NOT NULL DEFAULT 'tier0',
  ADD COLUMN IF NOT EXISTS address jsonb,
  ADD COLUMN IF NOT EXISTS payment_method_confirmed boolean NOT NULL DEFAULT false;

-- 3) Lots: reserve/current/anti-snipe
ALTER TABLE app.lots
  ADD COLUMN IF NOT EXISTS reserve_price numeric,
  ADD COLUMN IF NOT EXISTS reserve_met boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_price numeric,
  ADD COLUMN IF NOT EXISTS anti_snipe_extensions_used int NOT NULL DEFAULT 0;

-- 4) Bids: is_proxy flag
ALTER TABLE app.bids
  ADD COLUMN IF NOT EXISTS is_proxy boolean NOT NULL DEFAULT false;

-- 5) Proxy bids
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

-- 6) Bundling tables
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

-- 7) Orders: escrow fields
ALTER TABLE app.orders
  ADD COLUMN IF NOT EXISTS escrow_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escrow_status app.escrow_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS delivery_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispute_window_days int NOT NULL DEFAULT 3;

-- 8) Helper: bid increment ladder
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

-- 9) Helper: bid cap for verification tier
CREATE OR REPLACE FUNCTION app.bid_cap_for_tier(p_tier app.verification_tier)
RETURNS numeric AS $$
BEGIN
  IF p_tier = 'tier0' THEN RETURN 200; END IF;
  IF p_tier = 'tier1' THEN RETURN 1000; END IF;
  RETURN 1000000000; -- effectively no cap
END;
$$ LANGUAGE plpgsql STABLE;

-- 10) Proxy bidding in place_bid (upgrade existing RPC)
CREATE OR REPLACE FUNCTION app.place_bid(p_lot uuid, p_bidder uuid, p_amount numeric)
RETURNS TABLE (
  ok boolean,
  current_amount numeric,
  winner_id uuid,
  new_ends_at timestamptz,
  reserve_met boolean
) AS $$
DECLARE
  v_status app.lot_status;
  v_ends_at timestamptz;
  v_start_price numeric;
  v_reserve numeric;
  v_extensions int;
  v_now timestamptz := now();
  v_cap numeric;
  v_top_bidder uuid;
  v_top_max numeric;
  v_second_max numeric;
  v_prev_price numeric;
  v_new_price numeric;
  v_new_end timestamptz;
  v_increment numeric;
  v_existing_max numeric;
BEGIN
  -- Lock lot
  SELECT status, ends_at, start_price, reserve_price, anti_snipe_extensions_used, current_price
    INTO v_status, v_ends_at, v_start_price, v_reserve, v_extensions, v_prev_price
  FROM app.lots WHERE id = p_lot FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lot not found'; END IF;
  IF v_status <> 'running' THEN RAISE EXCEPTION 'Lot not running'; END IF;
  IF v_ends_at IS NOT NULL AND v_now >= v_ends_at THEN RAISE EXCEPTION 'Auction already ended'; END IF;

  -- Enforce bidder cap
  SELECT app.bid_cap_for_tier(COALESCE(verification_tier, 'tier0')) INTO v_cap
  FROM app.profiles WHERE id = p_bidder;
  IF v_cap IS NULL THEN v_cap := 200; END IF;
  IF p_amount > v_cap THEN
    RAISE EXCEPTION 'Bid exceeds your verification tier limit (cap=%). Please verify your account.', v_cap;
  END IF;

  -- Upsert proxy max (do not reset created_at)
  SELECT max_amount INTO v_existing_max FROM app.proxy_bids WHERE lot_id = p_lot AND bidder_id = p_bidder;
  IF NOT FOUND THEN
    INSERT INTO app.proxy_bids(lot_id, bidder_id, max_amount) VALUES (p_lot, p_bidder, p_amount);
  ELSE
    IF p_amount > v_existing_max THEN
      UPDATE app.proxy_bids SET max_amount = p_amount WHERE lot_id = p_lot AND bidder_id = p_bidder;
    END IF;
  END IF;

  -- Top two proxies (tie by earlier created_at)
  SELECT pb.bidder_id, pb.max_amount
    INTO v_top_bidder, v_top_max
  FROM app.proxy_bids pb
  WHERE pb.lot_id = p_lot
  ORDER BY pb.max_amount DESC, pb.created_at ASC
  LIMIT 1;

  SELECT max_amount
    INTO v_second_max
  FROM (
    SELECT pb.max_amount
    FROM app.proxy_bids pb
    WHERE pb.lot_id = p_lot AND pb.bidder_id <> v_top_bidder
    ORDER BY pb.max_amount DESC, pb.created_at ASC
    LIMIT 1
  ) s;

  -- Compute new price
  IF v_second_max IS NULL THEN
    v_new_price := GREATEST(COALESCE(v_prev_price, v_start_price), v_start_price);
  ELSE
    v_increment := app.bid_increment_for(v_second_max);
    v_new_price := LEAST(v_top_max, GREATEST(COALESCE(v_prev_price, v_start_price), v_second_max + v_increment));
  END IF;

  -- Ensure price does not decrease
  IF v_prev_price IS NOT NULL AND v_new_price < v_prev_price THEN
    v_new_price := v_prev_price;
  END IF;

  -- Update lot winner and price
  UPDATE app.lots
    SET winner_id = v_top_bidder,
        current_price = v_new_price,
        reserve_met = CASE WHEN v_reserve IS NOT NULL AND v_new_price >= v_reserve THEN true ELSE reserve_met END
    WHERE id = p_lot;

  -- Log proxy bid event
  INSERT INTO app.bids(lot_id, bidder_id, amount, is_proxy) VALUES (p_lot, v_top_bidder, v_new_price, true);

  -- Anti-snipe: +2m up to 5 extensions
  v_new_end := v_ends_at;
  IF v_ends_at IS NOT NULL AND (v_ends_at - v_now) <= INTERVAL '2 minutes' AND v_extensions < 5 THEN
    v_new_end := v_now + INTERVAL '2 minutes';
    UPDATE app.lots
      SET ends_at = v_new_end,
          anti_snipe_extensions_used = v_extensions + 1
      WHERE id = p_lot;
  END IF;

  RETURN QUERY SELECT true, v_new_price, v_top_bidder, v_new_end, (v_reserve IS NOT NULL AND v_new_price >= v_reserve);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11) Bundle resolver
CREATE OR REPLACE FUNCTION app.resolve_bundle(p_bundle uuid)
RETURNS TABLE (
  winner text,
  bundle_bidder uuid,
  bundle_amount numeric,
  individuals_amount numeric
) AS $$
DECLARE
  v_discount numeric;
  v_bundle_high numeric;
  v_bundle_bidder uuid;
  v_individuals_sum numeric := 0;
  v_threshold numeric;
BEGIN
  SELECT discount_percent INTO v_discount FROM app.bundles WHERE id = p_bundle;
  IF v_discount IS NULL THEN v_discount := 0; END IF;

  SELECT b.bidder_id, MAX(b.amount) INTO v_bundle_bidder, v_bundle_high
  FROM app.bundle_bids b WHERE b.bundle_id = p_bundle GROUP BY b.bidder_id ORDER BY MAX(b.amount) DESC LIMIT 1;

  SELECT COALESCE(SUM(x.max_amount), 0) INTO v_individuals_sum
  FROM (
    SELECT bi.lot_id, MAX(bi2.amount) AS max_amount
    FROM app.bundle_items bi
    LEFT JOIN app.bids bi2 ON bi2.lot_id = bi.lot_id
    GROUP BY bi.lot_id
  ) x;

  v_threshold := (1 - v_discount) * v_individuals_sum;

  IF v_bundle_high IS NOT NULL AND v_bundle_high >= v_threshold AND v_bundle_high >= v_individuals_sum THEN
    RETURN QUERY SELECT 'bundle'::text, v_bundle_bidder, v_bundle_high, v_individuals_sum;
  ELSE
    RETURN QUERY SELECT 'individuals'::text, NULL::uuid, COALESCE(v_bundle_high,0), v_individuals_sum;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12) Bid history export view (stable aliasing)
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

-- 13) Realtime row image for bids
ALTER TABLE app.bids REPLICA IDENTITY FULL;