-- Migration: Grant service_role direct table access for API routes
--
-- PROBLEM: Migration 002 only granted USAGE on the api schema to service_role,
-- but did not grant table-level privileges. This caused silent DELETE failures
-- because service_role lacked DELETE privilege on api.quotes — Supabase returns
-- { data: [], error: null } with 0 rows affected, making the API believe it succeeded.
--
-- service_role bypasses RLS (BYPASSRLS attribute) but still needs explicit
-- table grants for custom schemas like api.
--
-- Without this: DELETE /api/quotes returns 200 but the row remains in Supabase.

GRANT SELECT, INSERT, UPDATE, DELETE ON api.quotes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON api.usage_stats TO service_role;
GRANT SELECT, INSERT, DELETE ON api.rate_limits TO service_role;
GRANT SELECT ON api.rate_limit_config TO service_role;
