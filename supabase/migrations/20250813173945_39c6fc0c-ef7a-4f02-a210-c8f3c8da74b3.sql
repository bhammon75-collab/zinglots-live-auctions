-- WATCHLISTS
create table if not exists app.lot_watches(
  lot_id uuid not null references app.lots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lot_id, user_id)
);
create index if not exists idx_lot_watches_lot on app.lot_watches(lot_id);
alter table app.lot_watches enable row level security;
do $$ begin
  create policy lw_select on app.lot_watches for select using (true);
  create policy lw_ins    on app.lot_watches for insert with check (auth.uid() = user_id);
  create policy lw_del    on app.lot_watches for delete using (auth.uid() = user_id);
exception when duplicate_object then null end $$;

-- SAVED SEARCHES
create table if not exists app.saved_searches(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query jsonb not null,
  frequency text not null default 'daily',
  created_at timestamptz not null default now()
);
alter table app.saved_searches enable row level security;
do $$ begin
  create policy ss_select on app.saved_searches for select using (auth.uid() = user_id);
  create policy ss_ins    on app.saved_searches for insert with check (auth.uid() = user_id);
  create policy ss_del    on app.saved_searches for delete using (auth.uid() = user_id);
exception when duplicate_object then null end $$;

-- EMAIL JOB QUEUE
create table if not exists app.email_jobs(
  id bigserial primary key,
  type text not null, -- 'outbid' | 'ending_soon'
  lot_id uuid references app.lots(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  time_window text,
  status text not null default 'pending',
  attempts int not null default 0,
  scheduled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_email_jobs_status_time on app.email_jobs(status, scheduled_at);
create unique index if not exists uq_email_jobs_once on app.email_jobs(type, lot_id, user_id, coalesce(time_window,'-'));
alter table app.email_jobs disable row level security;

-- SEARCH RPC
create or replace function app.search_lots(p jsonb)
returns table(id uuid, title text, image_url text, ends_at timestamptz, reserve_met boolean, current_price numeric, starting_bid numeric, watchers int)
language sql security definer set search_path=app, public as $$
  with q as (
    select
      (p->'category')::jsonb as categories,
      (p->'priceRange'->>'min')::numeric as min_price,
      (p->'priceRange'->>'max')::numeric as max_price,
      (p->>'endingWithin')::text as ending_within,
      (p->>'auctionType')::text as auction_type,
      (p->>'search')::text as search
  )
  select
    l.id, l.title, l.image_url, a.ends_at, l.reserve_met,
    l.current_price, l.starting_bid,
    coalesce((select count(*) from app.lot_watches w where w.lot_id=l.id),0) as watchers
  from app.lots l
  join app.auctions a on a.id=l.auction_id
  cross join q
  where (q.search is null or l.title ilike '%'||q.search||'%' or l.description ilike '%'||q.search||'%')
    and (q.min_price is null or coalesce(l.current_price,l.starting_bid) >= q.min_price)
    and (q.max_price is null or coalesce(l.current_price,l.starting_bid) <= q.max_price)
    and (
      q.ending_within is null or
      (q.ending_within='1hour'  and a.ends_at <= now() + interval '1 hour') or
      (q.ending_within='6hours' and a.ends_at <= now() + interval '6 hours') or
      (q.ending_within='24hours' and a.ends_at <= now() + interval '24 hours')
    )
  order by a.ends_at asc, l.title asc;
$$;

-- WATCH RPCs
create or replace function app.watch_lot(p_lot uuid)
returns void language sql security definer set search_path=app, public as $$
  insert into app.lot_watches(lot_id,user_id) values (p_lot, auth.uid()) on conflict do nothing;
$$;

create or replace function app.unwatch_lot(p_lot uuid)
returns void language sql security definer set search_path=app, public as $$
  delete from app.lot_watches where lot_id=p_lot and user_id=auth.uid();
$$;