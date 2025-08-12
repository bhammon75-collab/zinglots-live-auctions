-- Replace existing place_bid with proxy bidding behavior and new return columns
DROP FUNCTION IF EXISTS app.place_bid(uuid, uuid, numeric);

CREATE FUNCTION app.place_bid(p_lot uuid, p_bidder uuid, p_amount numeric)
RETURNS TABLE (
  ok boolean,
  current_amount numeric,
  winner_id uuid,
  new_ends_at timestamptz,
  reserve_met boolean
) AS $$
DECLARE
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
  v_prev_price numeric;
  v_new_price numeric;
  v_new_end timestamptz;
  v_increment numeric;
  v_existing_max numeric;
BEGIN
  -- Lock lot
  SELECT status, ends_at, start_price, reserve_price, anti_snipe_extensions_used, current_price
    INTO v_status, v_ends_at, v_start_price, v_reserve, v_extensions, v_prev_price
  FROM app.lots WHERE id = p_lot FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lot not found'; END IF;
  IF v_status <> 'running' THEN RAISE EXCEPTION 'Lot not running'; END IF;
  IF v_ends_at IS NOT NULL AND v_now >= v_ends_at THEN RAISE EXCEPTION 'Auction already ended'; END IF;

  -- Enforce bidder cap
  SELECT app.bid_cap_for_tier(COALESCE(verification_tier, 'tier0')) INTO v_cap
  FROM app.profiles WHERE id = p_bidder;
  IF v_cap IS NULL THEN v_cap := 200; END IF;
  IF p_amount > v_cap THEN
    RAISE EXCEPTION 'Bid exceeds your verification tier limit (cap=%). Please verify your account.', v_cap;
  END IF;

  -- Upsert proxy max (do not reset created_at)
  SELECT max_amount INTO v_existing_max FROM app.proxy_bids WHERE lot_id = p_lot AND bidder_id = p_bidder;
  IF NOT FOUND THEN
    INSERT INTO app.proxy_bids(lot_id, bidder_id, max_amount) VALUES (p_lot, p_bidder, p_amount);
  ELSE
    IF p_amount > v_existing_max THEN
      UPDATE app.proxy_bids SET max_amount = p_amount WHERE lot_id = p_lot AND bidder_id = p_bidder;
    END IF;
  END IF;

  -- Top two proxies (tie by earlier created_at)
  SELECT pb.bidder_id, pb.max_amount
    INTO v_top_bidder, v_top_max
  FROM app.proxy_bids pb
  WHERE pb.lot_id = p_lot
  ORDER BY pb.max_amount DESC, pb.created_at ASC
  LIMIT 1;

  SELECT max_amount
    INTO v_second_max
  FROM (
    SELECT pb.max_amount
    FROM app.proxy_bids pb
    WHERE pb.lot_id = p_lot AND pb.bidder_id <> v_top_bidder
    ORDER BY pb.max_amount DESC, pb.created_at ASC
    LIMIT 1
  ) s;

  -- Compute new price
  IF v_second_max IS NULL THEN
    v_new_price := GREATEST(COALESCE(v_prev_price, v_start_price), v_start_price);
  ELSE
    v_increment := app.bid_increment_for(v_second_max);
    v_new_price := LEAST(v_top_max, GREATEST(COALESCE(v_prev_price, v_start_price), v_second_max + v_increment));
  END IF;

  -- Ensure price does not decrease
  IF v_prev_price IS NOT NULL AND v_new_price < v_prev_price THEN
    v_new_price := v_prev_price;
  END IF;

  -- Update lot winner and price
  UPDATE app.lots
    SET winner_id = v_top_bidder,
        current_price = v_new_price,
        reserve_met = CASE WHEN v_reserve IS NOT NULL AND v_new_price >= v_reserve THEN true ELSE reserve_met END
    WHERE id = p_lot;

  -- Log proxy bid event
  INSERT INTO app.bids(lot_id, bidder_id, amount, is_proxy) VALUES (p_lot, v_top_bidder, v_new_price, true);

  -- Anti-snipe: +2m up to 5 extensions
  v_new_end := v_ends_at;
  IF v_ends_at IS NOT NULL AND (v_ends_at - v_now) <= INTERVAL '2 minutes' AND v_extensions < 5 THEN
    v_new_end := v_now + INTERVAL '2 minutes';
    UPDATE app.lots
      SET ends_at = v_new_end,
          anti_snipe_extensions_used = v_extensions + 1
      WHERE id = p_lot;
  END IF;

  RETURN QUERY SELECT true, v_new_price, v_top_bidder, v_new_end, (v_reserve IS NOT NULL AND v_new_price >= v_reserve);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keep bids realtime fidelity
ALTER TABLE app.bids REPLICA IDENTITY FULL;