-- PHASED IMPLEMENTATION: Proxy bidding, reserve, increments, anti-snipe, bundling scaffolding,
-- verification tiers, escrow fields, and bid history export view
-- Schema: app (matches existing project code and edge functions)

-- 0) Safety: ensure schema exists
create schema if not exists app;

-- 1) Enums
create type app.verification_tier as enum ('tier0','tier1','tier2');
create type app.escrow_status as enum ('none','held','released','disputed');

-- 2) Profiles: verification fields
alter table app.profiles
  add column if not exists phone_verified boolean not null default false,
  add column if not exists verification_tier app.verification_tier not null default 'tier0',
  add column if not exists address jsonb,
  add column if not exists payment_method_confirmed boolean not null default false;

-- 3) Lots: reserve, current price, anti-snipe tracking
alter table app.lots
  add column if not exists reserve_price numeric,
  add column if not exists reserve_met boolean not null default false,
  add column if not exists current_price numeric,
  add column if not exists anti_snipe_extensions_used int not null default 0;

-- Ensure ends_at exists (was already present) and not null during running, but leave nullable for queued lots
-- We won't add NOT NULL constraint to avoid breaking queued lots.

-- 4) Bids: mark proxy vs manual
alter table app.bids
  add column if not exists is_proxy boolean not null default false;

-- 5) Proxy bids table (max bids per bidder per lot)
create table if not exists app.proxy_bids (
  lot_id uuid not null references app.lots(id) on delete cascade,
  bidder_id uuid not null references app.profiles(id) on delete cascade,
  max_amount numeric not null,
  created_at timestamptz not null default now(),
  primary key (lot_id, bidder_id)
);

-- RLS for proxy_bids
alter table app.proxy_bids enable row level security;
create policy if not exists "proxy_bids_public_read" on app.proxy_bids for select using (true);
create policy if not exists "proxy_bids_upsert_owner" on app.proxy_bids for insert with check (bidder_id = auth.uid());
create policy if not exists "proxy_bids_update_owner" on app.proxy_bids for update using (bidder_id = auth.uid());

-- 6) Bundling scaffolding
create table if not exists app.bundles (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references app.shows(id) on delete cascade,
  title text not null,
  discount_percent numeric not null default 0.10,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists app.bundle_items (
  bundle_id uuid not null references app.bundles(id) on delete cascade,
  lot_id uuid not null references app.lots(id) on delete cascade,
  primary key (bundle_id, lot_id)
);

create table if not exists app.bundle_bids (
  id bigserial primary key,
  bundle_id uuid not null references app.bundles(id) on delete cascade,
  bidder_id uuid not null references app.profiles(id) on delete cascade,
  amount numeric not null,
  is_proxy boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists app.bundle_proxy_bids (
  bundle_id uuid not null references app.bundles(id) on delete cascade,
  bidder_id uuid not null references app.profiles(id) on delete cascade,
  max_amount numeric not null,
  created_at timestamptz not null default now(),
  primary key (bundle_id, bidder_id)
);

-- RLS for bundles
alter table app.bundles enable row level security;
create policy if not exists "bundles_public_read" on app.bundles for select using (true);
create policy if not exists "bundles_owner_write" on app.bundles for insert with check (
  exists (select 1 from app.shows sh where sh.id = show_id and (sh.seller_id = auth.uid() or app.is_admin()))
);
create policy if not exists "bundles_owner_update" on app.bundles for update using (
  exists (select 1 from app.shows sh where sh.id = show_id and (sh.seller_id = auth.uid() or app.is_admin()))
);

alter table app.bundle_items enable row level security;
create policy if not exists "bundle_items_public_read" on app.bundle_items for select using (true);
create policy if not exists "bundle_items_owner_write" on app.bundle_items for insert with check (
  exists (
    select 1 from app.bundles b join app.shows sh on sh.id = b.show_id
    where b.id = bundle_id and (sh.seller_id = auth.uid() or app.is_admin())
  )
);

alter table app.bundle_bids enable row level security;
create policy if not exists "bundle_bids_public_read" on app.bundle_bids for select using (true);
create policy if not exists "bundle_bids_insert_auth" on app.bundle_bids for insert with check (auth.role() = 'authenticated');

alter table app.bundle_proxy_bids enable row level security;
create policy if not exists "bundle_proxy_bids_public_read" on app.bundle_proxy_bids for select using (true);
create policy if not exists "bundle_proxy_bids_upsert_owner" on app.bundle_proxy_bids for insert with check (bidder_id = auth.uid());
create policy if not exists "bundle_proxy_bids_update_owner" on app.bundle_proxy_bids for update using (bidder_id = auth.uid());

-- 7) Orders: escrow fields
alter table app.orders
  add column if not exists escrow_required boolean not null default false,
  add column if not exists escrow_status app.escrow_status not null default 'none',
  add column if not exists delivery_confirmed_at timestamptz,
  add column if not exists dispute_window_days int not null default 3;

-- 8) Helper: bid increment ladder
create or replace function app.bid_increment_for(p_amount numeric)
returns numeric as $$
begin
  if p_amount < 100 then return 5; end if;
  if p_amount < 500 then return 10; end if;
  if p_amount < 1000 then return 25; end if;
  if p_amount < 5000 then return 50; end if;
  if p_amount < 10000 then return 100; end if;
  return 250;
end;
$$ language plpgsql stable;

-- 9) Helper: bid cap for verification tier
create or replace function app.bid_cap_for_tier(p_tier app.verification_tier)
returns numeric as $$
begin
  if p_tier = 'tier0' then return 200; end if;
  if p_tier = 'tier1' then return 1000; end if;
  return 1000000000; -- effectively no cap
end;
$$ language plpgsql stable;

-- 10) Proxy bidding engine: upgrade existing place_bid to eBay-style max bidding
-- Interpret p_amount as the bidder's max amount. Tie rule: earlier max wins.
-- Anti-snipe: +2 minutes if bid within last 2 minutes, up to 5 extensions per lot.
create or replace function app.place_bid(p_lot uuid, p_bidder uuid, p_amount numeric)
returns table (
  ok boolean,
  current_amount numeric,
  winner_id uuid,
  new_ends_at timestamptz,
  reserve_met boolean
) as $$
declare
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
  v_second_time timestamptz;
  v_prev_price numeric;
  v_new_price numeric;
  v_new_end timestamptz;
  v_increment numeric;
  v_existing_max numeric;
  v_existing_created timestamptz;
begin
  -- Lock lot
  select status, ends_at, start_price, reserve_price, anti_snipe_extensions_used, current_price
    into v_status, v_ends_at, v_start_price, v_reserve, v_extensions, v_prev_price
  from app.lots where id = p_lot for update;
  if not found then raise exception 'Lot not found'; end if;
  if v_status <> 'running' then raise exception 'Lot not running'; end if;
  if v_ends_at is not null and v_now >= v_ends_at then raise exception 'Auction already ended'; end if;

  -- Enforce bidder cap by verification tier
  select app.bid_cap_for_tier(coalesce(verification_tier, 'tier0')) into v_cap
  from app.profiles where id = p_bidder;
  if v_cap is null then v_cap := 200; end if;
  if p_amount > v_cap then
    raise exception 'Bid exceeds your verification tier limit (cap=%). Please verify your account.', v_cap;
  end if;

  -- Upsert proxy max for this bidder (do not reset created_at if already exists)
  select max_amount, created_at into v_existing_max, v_existing_created
  from app.proxy_bids where lot_id = p_lot and bidder_id = p_bidder;
  if not found then
    insert into app.proxy_bids(lot_id, bidder_id, max_amount)
    values (p_lot, p_bidder, p_amount);
  else
    if p_amount > v_existing_max then
      update app.proxy_bids set max_amount = p_amount where lot_id = p_lot and bidder_id = p_bidder;
    end if;
  end if;

  -- Determine top two maxes (tie broken by earlier created_at)
  select pb.bidder_id, pb.max_amount
    into v_top_bidder, v_top_max
  from app.proxy_bids pb
  where pb.lot_id = p_lot
  order by pb.max_amount desc, pb.created_at asc
  limit 1;

  select max_amount, created_at
    into v_second_max, v_second_time
  from (
    select pb.max_amount, pb.created_at
    from app.proxy_bids pb
    where pb.lot_id = p_lot and pb.bidder_id <> v_top_bidder
    order by pb.max_amount desc, pb.created_at asc
    limit 1
  ) s;

  -- Compute new price
  if v_second_max is null then
    -- First or only proxy on the lot: current price is at least start_price
    v_new_price := greatest(coalesce(v_prev_price, v_start_price), v_start_price);
  else
    v_increment := app.bid_increment_for(v_second_max);
    v_new_price := least(v_top_max, greatest(coalesce(v_prev_price, v_start_price), v_second_max + v_increment));
  end if;

  -- Ensure price does not decrease
  if v_prev_price is not null and v_new_price < v_prev_price then
    v_new_price := v_prev_price;
  end if;

  -- Update lot winner and price
  update app.lots
    set winner_id = v_top_bidder,
        current_price = v_new_price,
        reserve_met = case when v_reserve is not null and v_new_price >= v_reserve then true else reserve_met end
    where id = p_lot;

  -- Record a proxy bid event (idempotency not enforced; clients should debounce)
  insert into app.bids(lot_id, bidder_id, amount, is_proxy) values (p_lot, v_top_bidder, v_new_price, true);

  -- Anti-snipe: extend by 2 minutes up to 5 times if within last 2 minutes
  v_new_end := v_ends_at;
  if v_ends_at is not null and (v_ends_at - v_now) <= interval '2 minutes' and v_extensions < 5 then
    v_new_end := v_now + interval '2 minutes';
    update app.lots
      set ends_at = v_new_end,
          anti_snipe_extensions_used = v_extensions + 1
      where id = p_lot;
  end if;

  return query select true, v_new_price, v_top_bidder, v_new_end, (v_reserve is not null and v_new_price >= v_reserve);
end;
$$ language plpgsql security definer;

-- 11) Bundle resolver: choose revenue-maximizing outcome with discount threshold
create or replace function app.resolve_bundle(p_bundle uuid)
returns table (
  winner text, -- 'bundle' or 'individuals'
  bundle_bidder uuid,
  bundle_amount numeric,
  individuals_amount numeric
) as $$
declare
  v_discount numeric;
  v_bundle_high numeric;
  v_bundle_bidder uuid;
  v_individuals_sum numeric := 0;
  v_threshold numeric;
begin
  select discount_percent into v_discount from app.bundles where id = p_bundle;
  if v_discount is null then v_discount := 0; end if;

  -- Highest bundle bid
  select b.bidder_id, max(b.amount) into v_bundle_bidder, v_bundle_high
  from app.bundle_bids b where b.bundle_id = p_bundle group by b.bidder_id order by max(b.amount) desc limit 1;

  -- Sum of leading individual high bids for lots in bundle
  select coalesce(sum(x.max_amount), 0) into v_individuals_sum
  from (
    select bi.lot_id, max(bi2.amount) as max_amount
    from app.bundle_items bi
    left join app.bids bi2 on bi2.lot_id = bi.lot_id
    group by bi.lot_id
  ) x;

  v_threshold := (1 - v_discount) * v_individuals_sum;

  if v_bundle_high is not null and v_bundle_high >= v_threshold and v_bundle_high >= v_individuals_sum then
    return query select 'bundle'::text, v_bundle_bidder, v_bundle_high, v_individuals_sum;
  else
    return query select 'individuals'::text, null::uuid, coalesce(v_bundle_high,0), v_individuals_sum;
  end if;
end;
$$ language plpgsql security definer;

-- 12) Bid history export view with anonymized aliases per lot
create or replace view app.bid_history as
select
  b.lot_id,
  b.created_at,
  concat('Bidder', lpad(dense_rank() over (partition by b.lot_id order by min(b.created_at) over (partition by b.lot_id, b.bidder_id)), 3, '0')) as bidder_alias,
  b.amount,
  b.is_proxy
from app.bids b;

-- 13) Realtime quality (optional but helpful)
alter table app.bids replica identity full;

-- Note: Existing end_lot function remains valid (uses max(bids.amount)).
-- Escrow logic and verification upgrades will be enforced in edge functions and UI flows.
