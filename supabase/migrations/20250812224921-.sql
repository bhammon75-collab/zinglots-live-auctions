-- Public wrapper to align frontend RPC signature
CREATE OR REPLACE FUNCTION public.place_bid(lot_id uuid, offered numeric, max numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = app, public
AS $$
DECLARE
  v_uid uuid;
  v_consider numeric;
  v_ok boolean;
  v_current numeric;
  v_winner uuid;
  v_ends timestamptz;
  v_reserve boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  v_consider := GREATEST(offered, COALESCE(max, offered));

  SELECT ok, current_amount, winner_id, new_ends_at, reserve_met
    INTO v_ok, v_current, v_winner, v_ends, v_reserve
  FROM app.place_bid(lot_id, v_uid, v_consider);

  RETURN jsonb_build_object(
    'ok', v_ok,
    'current_amount', v_current,
    'winner_id', v_winner,
    'new_ends_at', v_ends,
    'reserve_met', v_reserve
  );
END;
$$;

-- Public CSV helper using existing anonymized view
CREATE OR REPLACE FUNCTION public.public_bids_for_csv(p_lot_id uuid)
RETURNS TABLE (created_at timestamptz, alias text, amount numeric, is_proxy boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = app, public
AS $$
  SELECT b.created_at,
         b.bidder_alias AS alias,
         b.amount,
         b.is_proxy
  FROM app.bid_history b
  WHERE b.lot_id = p_lot_id
  ORDER BY b.created_at ASC;
$$;