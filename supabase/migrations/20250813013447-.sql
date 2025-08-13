-- Rate-limit: max 5 bids per 5 seconds per user
-- Add supporting index (idempotent)
CREATE INDEX IF NOT EXISTS idx_bids_bidder_time ON app.bids (bidder_id, created_at DESC);

-- Add throttle guard to public.place_bid wrapper
CREATE OR REPLACE FUNCTION public.place_bid(lot_id uuid, offered numeric, max numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'app', 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_consider numeric;
  v_ok boolean;
  v_current numeric;
  v_winner uuid;
  v_ends timestamptz;
  v_reserve boolean;
  v_recent int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Throttle: no more than 5 bids in the last 5 seconds per user
  SELECT count(*) INTO v_recent
  FROM app.bids
  WHERE bidder_id = v_uid
    AND created_at > now() - interval '5 seconds';

  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'Too many bids, slow down (rate limit)'
      USING ERRCODE = 'RLT01';
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
$function$;