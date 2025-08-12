-- Grant access for PostgREST to expose app schema to anon/authenticated
GRANT USAGE ON SCHEMA app TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO anon, authenticated;

-- Ensure future tables get the same privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;