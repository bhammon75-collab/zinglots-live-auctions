-- Harden function search_path for set_ship_by_after_payment
CREATE OR REPLACE FUNCTION app.set_ship_by_after_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'app','public'
AS $$
BEGIN
  IF NEW.paid_at IS NOT NULL AND (OLD.paid_at IS DISTINCT FROM NEW.paid_at) THEN
    NEW.ship_by_at := NEW.paid_at + make_interval(days => GREATEST(COALESCE(NEW.handling_days, 0), 0));
  END IF;
  RETURN NEW;
END;
$$;