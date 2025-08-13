-- Add show metadata columns
ALTER TABLE app.shows
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;

-- Seller applications table
CREATE TABLE IF NOT EXISTS app.seller_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  category_primary TEXT NOT NULL,
  avg_sell_price_cents INTEGER,
  lots_per_show_est INTEGER,
  shop_links JSONB DEFAULT '[]'::jsonb,
  timezone TEXT DEFAULT 'UTC',
  preferred_slots JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','approved','rejected','waitlist')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app.seller_applications ENABLE ROW LEVEL SECURITY;

-- RLS policies: open insert, read own
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = 'seller_applications' AND policyname = 'seller_apps_insert'
  ) THEN
    CREATE POLICY seller_apps_insert ON app.seller_applications
    FOR INSERT
    WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = 'seller_applications' AND policyname = 'seller_apps_select_own'
  ) THEN
    CREATE POLICY seller_apps_select_own ON app.seller_applications
    FOR SELECT
    USING (auth.uid() IS NOT NULL AND user_id = auth.uid());
  END IF;
END $$;

-- Show notifications table
CREATE TABLE IF NOT EXISTS app.show_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id UUID NOT NULL REFERENCES app.shows(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app.show_notifications ENABLE ROW LEVEL SECURITY;

-- RLS: anyone can insert notifications (no open select)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'app' AND tablename = 'show_notifications' AND policyname = 'show_notif_insert'
  ) THEN
    CREATE POLICY show_notif_insert ON app.show_notifications
    FOR INSERT
    WITH CHECK (true);
  END IF;
END $$;