-- WATCHLISTS
create table if not exists app.lot_watches(
  lot_id uuid not null references app.lots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lot_id, user_id)
);

create index if not exists idx_lot_watches_lot on app.lot_watches(lot_id);
alter table app.lot_watches enable row level security;

drop policy if exists lw_select on app.lot_watches;
drop policy if exists lw_ins on app.lot_watches;
drop policy if exists lw_del on app.lot_watches;

create policy lw_select on app.lot_watches for select using (true);
create policy lw_ins on app.lot_watches for insert with check (auth.uid() = user_id);
create policy lw_del on app.lot_watches for delete using (auth.uid() = user_id);

-- WATCH RPCs
create or replace function app.watch_lot(p_lot uuid)
returns void language sql security definer set search_path=app, public as $$
  insert into app.lot_watches(lot_id,user_id) values (p_lot, auth.uid()) on conflict do nothing;
$$;

create or replace function app.unwatch_lot(p_lot uuid)
returns void language sql security definer set search_path=app, public as $$
  delete from app.lot_watches where lot_id=p_lot and user_id=auth.uid();
$$;

create or replace function app.watch_count(p_lot uuid)
returns int language sql stable set search_path=app, public as $$
  select count(*)::int from app.lot_watches where lot_id=p_lot;
$$;