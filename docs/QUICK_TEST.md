# ZingLots Quick Test (MVP Flow)

This guide walks you through the MVP end-to-end using Supabase Edge Functions, Stripe (test), and LiveKit (dev).

1) Setup secrets (Supabase → Functions → Secrets)
- SUPABASE_SERVICE_ROLE_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_PLATFORM_FEE_BPS = 1200
- LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
- SITE_URL = https://zinglots.com (or your preview)
- (optional) POSTHOG_KEY

2) Deploy database schema
- Apply migration supabase/migrations/0001_app_schema.sql

3) Deploy edge functions
- livekit-token
- stripe-onboard
- checkout-create-session
- stripe-webhook
- shipping-create-label
- admin-settle

4) Test script (two browsers)
- Sign up as Buyer (email magic link or password)
- Apply to become a seller (create app.sellers row for your user); Admin marks verified
- Stripe Onboarding (Seller Dashboard → stripe-onboard → complete Express onboarding)
- Create a Show and Lots (insert rows in app.shows and app.lots)
- Start a Lot: set status=running, ends_at=now()+60s
- Place bids from another browser (call RPC app.place_bid); watch soft-close extend when bids land in last 10s
- End lot → create app.orders (status=invoiced) for the winner
- Begin checkout: POST to checkout-create-session; pay with Stripe test card 4242 4242 4242 4242
- Webhook updates order to paid and creates a pending payout
- Create shipping label: POST shipping-create-label (adds $1 platform label margin in UI)
- Admin: POST admin-settle → creates Stripe transfer to seller → order becomes settled

Notes
- Public read: shows, lots, bids
- Profiles are auto-created on first auth user via trigger
- RLS enforces buyer/seller/admin access; service role is used in functions for administrative writes
- Storage buckets: lot-photos (public read), evidence (private, signed URLs)
