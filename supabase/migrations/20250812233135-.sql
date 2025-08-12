-- Fix linter ERROR 0010: Security Definer View
-- Ensure view runs with invoking user's privileges and RLS
ALTER VIEW app.bid_history SET (security_invoker = on);