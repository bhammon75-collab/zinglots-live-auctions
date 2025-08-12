-- Seed demo data for ZingLots
-- NOTE: adjust UUIDs if needed; this is safe to re-run

-- Create demo profiles (assumes users already exist in auth.users)
-- Replace these UUIDs with actual auth user IDs in your project for full flows

-- Demo sellers
insert into app.profiles (id, handle, display_name, role)
values 
  ('00000000-0000-0000-0000-000000000001', 'brickvault', 'BrickVault', 'seller')
  on conflict (id) do nothing;
insert into app.sellers (id, kyc_status, fee_bps)
values 
  ('00000000-0000-0000-0000-000000000001', 'verified', 1200)
  on conflict (id) do nothing;

insert into app.profiles (id, handle, display_name, role)
values 
  ('00000000-0000-0000-0000-000000000002', 'retrohero', 'RetroHero Toys', 'seller')
  on conflict (id) do nothing;
insert into app.sellers (id, kyc_status, fee_bps)
values 
  ('00000000-0000-0000-0000-000000000002', 'pending', 1200)
  on conflict (id) do nothing;

-- Shows
insert into app.shows (id, seller_id, title, starts_at, status)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Friday Night Zing!', now() + interval '1 day', 'scheduled'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000002', 'Sunday Super Selects', now() + interval '2 days', 'scheduled')
  on conflict (id) do nothing;

-- Lots (20 across categories)
with cat as (
  select unnest(array['TCG','LEGO','FIGURE','DIECAST','PLUSH']::app.category[]) as c
)
insert into app.lots (id, show_id, category, title, description, start_price, bid_increment, status)
select gen_random_uuid(),
       case when i % 2 = 0 then '11111111-1111-1111-1111-111111111111' else '22222222-2222-2222-2222-222222222222' end,
       (select c from cat limit 1 offset (i % 5)),
       concat('Collector Lot #', 1000 + i),
       'Demo lot',
       10 + i,
       1,
       'queued'
from generate_series(0,19) as s(i);
