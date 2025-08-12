-- Supabase Migration: app schema, RLS, RPC, storage
-- Requires: pgcrypto extension for gen_random_uuid
create extension if not exists pgcrypto;

-- 1) Schema
create schema if not exists app;

-- 2) Enums
create type app.user_role as enum ('buyer','seller','admin');
create type app.kyc_status as enum ('pending','verified','rejected');
create type app.show_status as enum ('scheduled','live','ended','canceled');
create type app.category as enum ('TCG','LEGO','FIGURE','DIECAST','PLUSH');
create type app.lot_status as enum ('queued','running','sold','unsold','void');
create type app.order_status as enum ('invoiced','paid','shipped','settled','refunded');
create type app.payout_status as enum ('pending','transferred','failed');
create type app.dispute_type as enum ('counterfeit','not_as_described','damaged','shipping');
create type app.dispute_status as enum ('open','seller_won','buyer_won','refunded');

-- 3) Tables
create table if not exists app.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  avatar_url text,
  role app.user_role not null default 'buyer',
  created_at timestamptz not null default now()
);

create table if not exists app.sellers (
  id uuid primary key references app.profiles(id) on delete cascade,
  kyc_status app.kyc_status not null default 'pending',
  stripe_account_id text,
  fee_bps int,
  rating numeric(3,2) not null default 5.00
);

create table if not exists app.shows (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references app.sellers(id) on delete cascade,
  title text not null,
  starts_at timestamptz,
  status app.show_status not null default 'scheduled',
  stream_key text unique,
  created_at timestamptz not null default now()
);

create table if not exists app.lots (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references app.shows(id) on delete cascade,
  category app.category not null,
  title text not null,
  description text,
  photos jsonb,
  evidence jsonb,
  start_price numeric not null,
  buy_now_price numeric,
  bid_increment numeric not null default 1.00,
  ends_at timestamptz,
  winner_id uuid references app.profiles(id),
  status app.lot_status not null default 'queued',
  created_at timestamptz not null default now()
);

create table if not exists app.bids (
  id bigserial primary key,
  lot_id uuid not null references app.lots(id) on delete cascade,
  bidder_id uuid not null references app.profiles(id) on delete cascade,
  amount numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists app.orders (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid unique references app.lots(id) on delete cascade,
  buyer_id uuid not null references app.profiles(id) on delete cascade,
  status app.order_status not null default 'invoiced',
  subtotal numeric not null, -- dollars
  fees_bps int not null default 1200,
  shipping_cents int not null default 0,
  stripe_payment_intent text,
  created_at timestamptz not null default now()
);

create table if not exists app.payouts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique references app.orders(id) on delete cascade,
  seller_id uuid not null references app.sellers(id) on delete cascade,
  amount numeric not null, -- dollars to transfer to seller
  status app.payout_status not null default 'pending',
  stripe_transfer_id text,
  created_at timestamptz not null default now()
);

create table if not exists app.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references app.orders(id) on delete cascade,
  type app.dispute_type not null,
  status app.dispute_status not null default 'open',
  notes text,
  created_at timestamptz not null default now()
);

-- Optional chat persistence
create table if not exists app.chat_messages (
  id bigserial primary key,
  show_id uuid not null references app.shows(id) on delete cascade,
  profile_id uuid not null references app.profiles(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

-- 4) Helper: create profile on new auth user
create or replace function app.handle_new_user()
returns trigger as $$
begin
  insert into app.profiles (id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), 'buyer')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure app.handle_new_user();

-- 5) Admin helper
create or replace function app.is_admin()
returns boolean as $$
  select exists (
    select 1 from app.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$ language sql stable;

-- 6) RPC: place_bid with soft-close
create or replace function app.place_bid(p_lot uuid, p_bidder uuid, p_amount numeric)
returns table (ok boolean, new_amount numeric, new_ends_at timestamptz) as $$
declare
  v_status app.lot_status;
  v_increment numeric;
  v_ends_at timestamptz;
  v_start_price numeric;
  v_top_bid numeric;
  v_min_required numeric;
  v_new_end timestamptz;
begin
  -- lock the lot row to prevent race conditions
  select status, bid_increment, ends_at, start_price
    into v_status, v_increment, v_ends_at, v_start_price
  from app.lots where id = p_lot for update;

  if not found then
    raise exception 'Lot not found';
  end if;
  if v_status <> 'running' then
    raise exception 'Lot not running';
  end if;

  select max(amount) into v_top_bid from app.bids where lot_id = p_lot;
  v_min_required := greatest(coalesce(v_top_bid, v_start_price) + v_increment, v_start_price);

  if p_amount < v_min_required then
    return query select false, coalesce(v_top_bid, v_start_price), v_ends_at;
    return;
  end if;

  insert into app.bids(lot_id, bidder_id, amount) values (p_lot, p_bidder, p_amount);

  v_new_end := v_ends_at;
  if v_ends_at is not null and (v_ends_at - now()) <= interval '10 seconds' then
    v_new_end := now() + interval '15 seconds';
    update app.lots set ends_at = v_new_end where id = p_lot;
  end if;

  update app.lots set winner_id = p_bidder where id = p_lot;

  return query select true, p_amount, v_new_end;
end;
$$ language plpgsql security definer;

-- 7) RLS policies
alter table app.profiles enable row level security;
alter table app.sellers enable row level security;
alter table app.shows enable row level security;
alter table app.lots enable row level security;
alter table app.bids enable row level security;
alter table app.orders enable row level security;
alter table app.payouts enable row level security;
alter table app.disputes enable row level security;
alter table app.chat_messages enable row level security;

-- profiles policies
create policy "profiles_select_self_or_admin" on app.profiles for select
  using (id = auth.uid() or app.is_admin());
create policy "profiles_update_self_or_admin" on app.profiles for update
  using (id = auth.uid() or app.is_admin());
create policy "profiles_insert_self" on app.profiles for insert
  with check (id = auth.uid() or app.is_admin());

-- sellers policies
create policy "sellers_read_self_or_admin" on app.sellers for select
  using (id = auth.uid() or app.is_admin());
create policy "sellers_insert_self" on app.sellers for insert
  with check (id = auth.uid() or app.is_admin());
create policy "sellers_update_self_or_admin" on app.sellers for update
  using (id = auth.uid() or app.is_admin());

-- shows policies
create policy "shows_public_read" on app.shows for select using (true);
create policy "shows_insert_verified_seller" on app.shows for insert
  with check (exists (select 1 from app.sellers s where s.id = auth.uid() and s.kyc_status = 'verified'));
create policy "shows_update_owner" on app.shows for update
  using (seller_id = auth.uid() or app.is_admin());
create policy "shows_delete_owner" on app.shows for delete
  using (seller_id = auth.uid() or app.is_admin());

-- lots policies
create policy "lots_public_read" on app.lots for select using (true);
create policy "lots_insert_owner" on app.lots for insert
  with check (exists (
    select 1 from app.shows sh where sh.id = show_id and (sh.seller_id = auth.uid() or app.is_admin())
  ));
create policy "lots_update_owner" on app.lots for update
  using (exists (
    select 1 from app.shows sh where sh.id = app.lots.show_id and (sh.seller_id = auth.uid() or app.is_admin())
  ));
create policy "lots_delete_owner" on app.lots for delete
  using (exists (
    select 1 from app.shows sh where sh.id = app.lots.show_id and (sh.seller_id = auth.uid() or app.is_admin())
  ));

-- bids policies
create policy "bids_public_read" on app.bids for select using (true);
create policy "bids_insert_any_auth" on app.bids for insert with check (auth.role() = 'authenticated');

-- orders policies
create policy "orders_select_buyer_or_admin" on app.orders for select
  using (buyer_id = auth.uid() or app.is_admin());
create policy "orders_update_buyer_or_admin" on app.orders for update
  using (buyer_id = auth.uid() or app.is_admin());
-- Inserts should come from trusted code (edge functions using service role)
create policy "orders_insert_admin_only" on app.orders for insert
  with check (app.is_admin());

-- payouts policies
create policy "payouts_select_seller_or_admin" on app.payouts for select
  using (seller_id = auth.uid() or app.is_admin());
create policy "payouts_admin_write" on app.payouts for insert with check (app.is_admin());
create policy "payouts_admin_update" on app.payouts for update using (app.is_admin());

-- disputes policies
create policy "disputes_select_buyer_or_admin" on app.disputes for select
  using (
    app.is_admin() or exists (
      select 1 from app.orders o where o.id = order_id and o.buyer_id = auth.uid()
    )
  );
create policy "disputes_insert_buyer_or_admin" on app.disputes for insert
  with check (
    app.is_admin() or exists (
      select 1 from app.orders o where o.id = order_id and o.buyer_id = auth.uid()
    )
  );
create policy "disputes_update_admin" on app.disputes for update using (app.is_admin());

-- chat policies
create policy "chat_public_read" on app.chat_messages for select using (true);
create policy "chat_insert_auth" on app.chat_messages for insert with check (auth.role() = 'authenticated');

-- 8) Storage buckets and policies
insert into storage.buckets (id, name, public) values ('lot-photos','lot-photos', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('evidence','evidence', false)
  on conflict (id) do nothing;

-- Storage RLS is on storage.objects
create policy "lot_photos_public_read" on storage.objects for select using (bucket_id = 'lot-photos');
create policy "lot_photos_seller_write" on storage.objects for insert
  with check (
    bucket_id = 'lot-photos' and exists (select 1 from app.sellers s where s.id = auth.uid() and s.kyc_status = 'verified')
  );
create policy "lot_photos_owner_update" on storage.objects for update
  using (bucket_id = 'lot-photos' and owner = auth.uid());
create policy "evidence_owner_read" on storage.objects for select
  using (bucket_id = 'evidence' and owner = auth.uid());
create policy "evidence_owner_write" on storage.objects for insert
  with check (bucket_id = 'evidence' and owner = auth.uid());

-- 9) Seed minimal demo (use separate seed steps for real data)
