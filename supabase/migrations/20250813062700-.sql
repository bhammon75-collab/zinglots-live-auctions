-- 20250812_listings_first.sql (adjusted to avoid conflicts with existing live auction status)
-- Extend lots to support standalone listings (Buy Now / Offers / Timed Auction)
-- NOTE: Using listing_status to avoid clashing with existing app.lots.status used by live shows

-- Add listing fields
ALTER TABLE app.lots
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'buy_now' CHECK (type IN ('buy_now','auction')),
  ADD COLUMN IF NOT EXISTS price_buy_now_cents integer,
  ADD COLUMN IF NOT EXISTS offer_min_cents integer,
  ADD COLUMN IF NOT EXISTS offer_auto_decline_cents integer,
  ADD COLUMN IF NOT EXISTS auction_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS listing_status text DEFAULT 'active' CHECK (listing_status IN ('active','sold','ended','void')),
  ADD COLUMN IF NOT EXISTS shipping_policy text DEFAULT 'flat' CHECK (shipping_policy IN ('flat','free','pickup')),
  ADD COLUMN IF NOT EXISTS shipping_flat_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS handling_days integer DEFAULT 2;

-- Watchlists
CREATE TABLE IF NOT EXISTS app.watchlists (
  user_id uuid NOT NULL,
  lot_id uuid NOT NULL REFERENCES app.lots(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lot_id)
);
ALTER TABLE app.watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS watchlist_rw ON app.watchlists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Saved Searches
CREATE TABLE IF NOT EXISTS app.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  query_json jsonb NOT NULL,
  cadence text NOT NULL DEFAULT 'daily' CHECK (cadence IN ('instant','daily','weekly')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app.saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS saved_searches_rw ON app.saved_searches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Product feed throttle (optional records of notifications sent)
CREATE TABLE IF NOT EXISTS app.listing_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES app.lots(id) ON DELETE CASCADE,
  type text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);
