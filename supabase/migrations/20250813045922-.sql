-- Add Stripe Connect status fields to app.sellers
ALTER TABLE app.sellers
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS connect_details_submitted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS connect_charges_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS connect_payouts_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS connect_requirements jsonb;

-- Helpful index for lookups by Stripe account id
CREATE INDEX IF NOT EXISTS sellers_stripe_account_id_idx ON app.sellers (stripe_account_id);
