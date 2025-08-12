-- Harden SECURITY DEFINER functions: set immutable search_path
ALTER FUNCTION app.place_bid(uuid, uuid, numeric) SET search_path = '';
ALTER FUNCTION app.resolve_bundle(uuid) SET search_path = '';
ALTER FUNCTION app.bid_increment_for(numeric) SET search_path = '';
ALTER FUNCTION app.bid_cap_for_tier(app.verification_tier) SET search_path = '';
