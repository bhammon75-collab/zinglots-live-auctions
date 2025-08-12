-- SQL helper: end lot and create order if winner exists
-- Usage: select * from app.end_lot('<lot_uuid>');

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
