-- Create app schema and core enums
create schema if not exists app;

-- Required for gen_random_uuid
create extension if not exists pgcrypto;

-- Enums
create type app.user_role as enum ('buyer','seller','admin');
create type app.kyc_status as enum ('pending','verified','rejected');
create type app.show_status as enum ('scheduled','live','ended','canceled');
create type app.lot_status as enum ('queued','running','sold','unsold','void');
create type app.order_status as enum ('invoiced','paid','settled','refunded');
create type app.payout_status as enum ('pending','transferred','failed');
create type app.dispute_type as enum ('item_not_received','item_not_as_described','other');
create type app.dispute_status as enum ('open','under_review','resolved','rejected');
create type app.category as enum ('TCG','LEGO','FIGURE','DIECAST','PLUSH');

-- Utility function: auto-update updated_at
create or replace function app.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Security definer function to check admin role
create or replace function app.is_admin()
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (
    select 1 from app.profiles p
    where p.id = auth.uid() and p.role = 'admin'::app.user_role
  );
$$;

-- Helper: check if current user is the seller that owns a show
create or replace function app.is_seller_of_show(_show_id uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (
    select 1
    from app.shows s
    where s.id = _show_id and s.seller_id = auth.uid()
  );
$$;

-- Tables
create table if not exists app.profiles (
  id uuid primary key, -- auth user id
  handle text unique,
  display_name text,
  role app.user_role not null default 'buyer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.sellers (
  id uuid primary key references app.profiles(id) on delete cascade,
  kyc_status app.kyc_status not null default 'pending',
  fee_bps integer not null default 1200,
  stripe_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.shows (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references app.sellers(id) on delete cascade,
  title text not null,
  starts_at timestamptz,
  status app.show_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_shows_seller on app.shows(seller_id);

create table if not exists app.lots (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references app.shows(id) on delete cascade,
  category app.category not null,
  title text not null,
  description text,
  start_price numeric(12,2) not null default 0,
  bid_increment numeric(12,2) not null default 1,
  status app.lot_status not null default 'queued',
  winner_id uuid references app.profiles(id),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lots_show on app.lots(show_id);
create index if not exists idx_lots_status on app.lots(status);

create table if not exists app.bids (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references app.lots(id) on delete cascade,
  bidder_id uuid not null references app.profiles(id) on delete cascade,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_bids_lot on app.bids(lot_id);
create index if not exists idx_bids_lot_created on app.bids(lot_id, created_at desc);

create table if not exists app.orders (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references app.lots(id) on delete restrict,
  buyer_id uuid not null references app.profiles(id) on delete restrict,
  status app.order_status not null default 'invoiced',
  subtotal numeric(12,2) not null default 0,
  fees_bps integer not null default 1200,
  shipping_cents integer not null default 0,
  shipping_tracking text,
  shipping_carrier text,
  label_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orders_buyer on app.orders(buyer_id);
create index if not exists idx_orders_status on app.orders(status);

create table if not exists app.payouts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references app.orders(id) on delete cascade,
  seller_id uuid not null references app.sellers(id) on delete restrict,
  amount numeric(12,2) not null,
  status app.payout_status not null default 'pending',
  stripe_transfer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payouts_seller on app.payouts(seller_id);
create index if not exists idx_payouts_status on app.payouts(status);

create table if not exists app.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references app.orders(id) on delete cascade,
  buyer_id uuid not null references app.profiles(id) on delete restrict,
  type app.dispute_type not null,
  status app.dispute_status not null default 'open',
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.chat_messages (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references app.shows(id) on delete cascade,
  sender_id uuid not null references app.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_show on app.chat_messages(show_id);

-- Triggers for updated_at
create or replace function app.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Attach updated_at triggers
create trigger t_profiles_updated before update on app.profiles for each row execute procedure app.touch_updated_at();
create trigger t_sellers_updated before update on app.sellers for each row execute procedure app.touch_updated_at();
create trigger t_shows_updated before update on app.shows for each row execute procedure app.touch_updated_at();
create trigger t_lots_updated before update on app.lots for each row execute procedure app.touch_updated_at();
create trigger t_orders_updated before update on app.orders for each row execute procedure app.touch_updated_at();
create trigger t_payouts_updated before update on app.payouts for each row execute procedure app.touch_updated_at();
create trigger t_disputes_updated before update on app.disputes for each row execute procedure app.touch_updated_at();

-- Enable RLS
alter table app.profiles enable row level security;
alter table app.sellers enable row level security;
alter table app.shows enable row level security;
alter table app.lots enable row level security;
alter table app.bids enable row level security;
alter table app.orders enable row level security;
alter table app.payouts enable row level security;
alter table app.disputes enable row level security;
alter table app.chat_messages enable row level security;

-- Profiles policies
create policy "Profiles: view self or admin" on app.profiles for select using (
  id = auth.uid() or app.is_admin()
);
create policy "Profiles: update self or admin" on app.profiles for update using (
  id = auth.uid() or app.is_admin()
) with check (id = auth.uid() or app.is_admin());
create policy "Profiles: insert self" on app.profiles for insert with check (id = auth.uid());

-- Sellers policies
create policy "Sellers: view self or admin" on app.sellers for select using (
  id = auth.uid() or app.is_admin()
);
create policy "Sellers: insert self" on app.sellers for insert with check (id = auth.uid());
create policy "Sellers: update self or admin" on app.sellers for update using (
  id = auth.uid() or app.is_admin()
) with check (id = auth.uid() or app.is_admin());

-- Shows policies (publicly viewable)
create policy "Shows: view all" on app.shows for select using (true);
create policy "Shows: insert by seller" on app.shows for insert with check (seller_id = auth.uid() or app.is_admin());
create policy "Shows: update by owner or admin" on app.shows for update using (
  seller_id = auth.uid() or app.is_admin()
) with check (seller_id = auth.uid() or app.is_admin());

-- Lots policies (publicly viewable)
create policy "Lots: view all" on app.lots for select using (true);
create policy "Lots: insert by show's seller" on app.lots for insert with check (
  app.is_seller_of_show(show_id) or app.is_admin()
);
create policy "Lots: update by show's seller or admin" on app.lots for update using (
  app.is_seller_of_show(show_id) or app.is_admin()
) with check (app.is_seller_of_show(show_id) or app.is_admin());

-- Bids policies
create policy "Bids: view all" on app.bids for select using (true);
create policy "Bids: place bids as self" on app.bids for insert with check (
  bidder_id = auth.uid()
);

-- Orders policies
create policy "Orders: buyer or seller or admin can view" on app.orders for select using (
  buyer_id = auth.uid()
  or app.is_admin()
  or exists (
    select 1 from app.lots l join app.shows s on s.id = l.show_id
    where l.id = app.orders.lot_id and s.seller_id = auth.uid()
  )
);
create policy "Orders: admin can update" on app.orders for update using (app.is_admin()) with check (app.is_admin());
create policy "Orders: buyer can insert own" on app.orders for insert with check (buyer_id = auth.uid());

-- Payouts policies
create policy "Payouts: view by seller or admin" on app.payouts for select using (
  seller_id = auth.uid() or app.is_admin()
);
create policy "Payouts: admin update" on app.payouts for update using (app.is_admin()) with check (app.is_admin());
create policy "Payouts: admin insert" on app.payouts for insert with check (app.is_admin());

-- Disputes policies
create policy "Disputes: view by buyer or admin" on app.disputes for select using (
  buyer_id = auth.uid() or app.is_admin()
);
create policy "Disputes: insert by buyer" on app.disputes for insert with check (buyer_id = auth.uid());
create policy "Disputes: update by admin" on app.disputes for update using (app.is_admin()) with check (app.is_admin());

-- Chat policies
create policy "Chat: view all" on app.chat_messages for select using (true);
create policy "Chat: insert auth users" on app.chat_messages for insert with check (auth.uid() = sender_id);

-- Auction RPC: place_bid with soft close
create or replace function app.place_bid(p_lot uuid, p_amount numeric)
returns app.bids as $$
declare
  v_cur_top numeric;
  v_bid_inc numeric;
  v_start_price numeric;
  v_status app.lot_status;
  v_ends timestamptz;
  v_bid app.bids%rowtype;
begin
  select status, ends_at, bid_increment, start_price
    into v_status, v_ends, v_bid_inc, v_start_price
  from app.lots where id = p_lot for update;

  if not found then
    raise exception 'Lot not found';
  end if;
  if v_status <> 'running' then
    raise exception 'Lot not running';
  end if;

  select max(amount) into v_cur_top from app.bids where lot_id = p_lot;
  if v_cur_top is null then v_cur_top := v_start_price; end if;
  if p_amount < v_cur_top + v_bid_inc then
    raise exception 'Bid too low';
  end if;

  insert into app.bids (lot_id, bidder_id, amount)
  values (p_lot, auth.uid(), p_amount)
  returning * into v_bid;

  -- Soft close: extend by 15s if under 10s left
  if v_ends is not null and v_ends - now() < interval '10 seconds' then
    update app.lots set ends_at = now() + interval '15 seconds' where id = p_lot;
  end if;

  return v_bid;
end;
$$ language plpgsql;

-- Helper to end lot and create order (from docs/migrations/0002)
create or replace function app.end_lot(p_lot uuid)
returns table (order_id uuid, winner_id uuid, final_amount numeric) as $$
declare
  v_show uuid;
  v_winner uuid;
  v_amount numeric;
  v_order uuid;
begin
  -- finalize lot
  select show_id into v_show from app.lots where id = p_lot for update;
  if not found then raise exception 'Lot not found'; end if;

  select bidder_id, max(amount) into v_winner, v_amount from app.bids where lot_id = p_lot group by bidder_id order by max(amount) desc limit 1;

  if v_winner is null then
    update app.lots set status = 'unsold' where id = p_lot;
    return;
  end if;

  update app.lots set status = 'sold', winner_id = v_winner where id = p_lot;

  insert into app.orders (lot_id, buyer_id, status, subtotal)
  values (p_lot, v_winner, 'invoiced', v_amount)
  returning id into v_order;

  return query select v_order, v_winner, v_amount;
end;
$$ language plpgsql security definer;

-- Realtime: capture full row and publish
alter table app.lots replica identity full;
alter table app.bids replica identity full;
-- Add to realtime publication (safe if already added)
begin;
  alter publication supabase_realtime add table app.lots;
exception when duplicate_object then null;
end;
begin;
  alter publication supabase_realtime add table app.bids;
exception when duplicate_object then null;
end;

-- Storage setup (buckets and policies)
insert into storage.buckets (id, name, public) values ('lot-photos','lot-photos', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('evidence','evidence', false)
  on conflict (id) do nothing;

-- Public read for lot photos
create policy if not exists "Lot photos are public" on storage.objects
for select using (bucket_id = 'lot-photos');

-- Sellers can manage their lot photos (folder named by user id)
create policy if not exists "Sellers upload their photos" on storage.objects
for insert with check (
  bucket_id = 'lot-photos' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy if not exists "Sellers update their photos" on storage.objects
for update using (
  bucket_id = 'lot-photos' and auth.uid()::text = (storage.foldername(name))[1]
);

-- Evidence is private to owner
create policy if not exists "Evidence: owner can read" on storage.objects
for select using (
  bucket_id = 'evidence' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy if not exists "Evidence: owner can write" on storage.objects
for insert with check (
  bucket_id = 'evidence' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy if not exists "Evidence: owner can update" on storage.objects
for update using (
  bucket_id = 'evidence' and auth.uid()::text = (storage.foldername(name))[1]
);

-- Seed demo data (safe to re-run)
insert into app.profiles (id, handle, display_name, role) values
  ('00000000-0000-0000-0000-000000000001', 'brickvault', 'BrickVault', 'seller'),
  ('00000000-0000-0000-0000-000000000002', 'retrohero', 'RetroHero Toys', 'seller')
on conflict (id) do nothing;

insert into app.sellers (id, kyc_status, fee_bps) values
  ('00000000-0000-0000-0000-000000000001', 'verified', 1200),
  ('00000000-0000-0000-0000-000000000002', 'pending', 1200)
on conflict (id) do nothing;

insert into app.shows (id, seller_id, title, starts_at, status) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Friday Night Zing!', now() + interval '1 day', 'scheduled'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000002', 'Sunday Super Selects', now() + interval '2 days', 'scheduled')
on conflict (id) do nothing;

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
