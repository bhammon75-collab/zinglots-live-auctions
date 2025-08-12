-- Create RPC to ensure a running show for the authenticated seller
create or replace function public.go_live()
returns uuid
language plpgsql
security definer
set search_path = 'app', 'public'
as $$
declare
  v_uid uuid;
  v_show uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  -- Ensure seller is verified and has Stripe connected
  if not exists (
    select 1 from app.sellers s
    where s.id = v_uid
      and s.kyc_status = 'verified'
      and s.stripe_account_id is not null
  ) then
    raise exception 'Seller not verified or missing Stripe';
  end if;

  select id into v_show
  from app.shows
  where seller_id = v_uid and status = 'running'
  order by created_at desc
  limit 1;

  if v_show is null then
    insert into app.shows (seller_id, status)
    values (v_uid, 'running')
    returning id into v_show;
  end if;

  return v_show;
end;
$$;

-- Create RPC to start a quick lot for the authenticated seller
create or replace function public.start_lot(
  p_title text,
  p_starting numeric,
  p_duration_secs integer
)
returns uuid
language plpgsql
security definer
set search_path = 'app', 'public'
as $$
declare
  v_uid uuid;
  v_show uuid;
  v_lot uuid;
  v_ends timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  -- Ensure seller is verified and has Stripe connected
  if not exists (
    select 1 from app.sellers s
    where s.id = v_uid
      and s.kyc_status = 'verified'
      and s.stripe_account_id is not null
  ) then
    raise exception 'Seller not verified or missing Stripe';
  end if;

  -- Ensure there is a running show
  select id into v_show
  from app.shows
  where seller_id = v_uid and status = 'running'
  order by created_at desc
  limit 1;

  if v_show is null then
    insert into app.shows (seller_id, status)
    values (v_uid, 'running')
    returning id into v_show;
  end if;

  v_ends := now() + make_interval(secs => greatest(coalesce(p_duration_secs, 60), 10));

  insert into app.lots (show_id, title, status, starting_bid, ends_at)
  values (
    v_show,
    coalesce(nullif(p_title, ''), 'Quick Lot'),
    'running',
    coalesce(p_starting, 10),
    v_ends
  )
  returning id into v_lot;

  return v_lot;
end;
$$;