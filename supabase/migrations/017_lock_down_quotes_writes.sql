-- Close the direct-write hole on api.quotes.
--
-- PROBLEM
-- Migration 002 created the INSERT policy with a WITH CHECK that only asserted
-- three columns are non-empty:
--
--   customer_name IS NOT NULL AND customer_name != ''
--   AND slug IS NOT NULL AND slug != ''
--   AND owner_token_hash IS NOT NULL AND owner_token_hash != ''
--
-- It never constrained user_id, and it was not restricted to a role. Combined
-- with `GRANT SELECT, INSERT, UPDATE, DELETE ON api.quotes TO authenticated`
-- (002, step 7) and a browser client pointed at the `api` schema with the
-- public anon key (lib/supabase/client.ts), any signed-in user could write
-- rows directly from devtools:
--
--   supabase.from('quotes').insert({ ..., user_id: '<someone else>' })
--
-- That bypassed every guarantee /api/quotes provides — the monthly
-- quotes_created quota gate, the string length caps, the server-side
-- items_sum recompute, the status-regression guard and the ownership
-- binding — and let a row be attributed to another user, where the SELECT
-- policy (user_id = auth.uid()) would then surface it in the victim's
-- dashboard.
--
-- Migration 014 tightened SELECT only; the write policies were untouched.
--
-- FIX
-- 1. Revoke the direct write grants. Every write path already goes through
--    service_role (/api/quotes POST + DELETE, /api/quotes/bind,
--    /api/accept-quote), which bypasses RLS, so nothing in the app loses
--    access. The only client-side table access is the SELECT in
--    getQuoteByIdFromSupabase, which keeps its grant.
-- 2. Recreate the INSERT policy with an ownership check anyway, so that
--    re-granting INSERT later cannot silently reopen the hole.
--
-- SAFE because:
-- - service_role has BYPASSRLS and its own grants (migration 005), so all
--   API routes are unaffected.
-- - The legacy anon write RPCs (create_quote, update_quote_anon,
--   delete_quote_anon) are SECURITY DEFINER and run as the function owner,
--   so revoking table grants does not break them.
-- ============================================

-- ============================================
-- 1. Recreate INSERT policy with an ownership check
-- ============================================
DROP POLICY IF EXISTS "quotes_insert" ON api.quotes;

-- Anonymous rows (user_id IS NULL) are only reachable through the
-- SECURITY DEFINER RPCs and service_role, never through this policy —
-- `authenticated` by definition has an auth.uid().
CREATE POLICY "quotes_insert"
  ON api.quotes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND customer_name IS NOT NULL AND customer_name != ''
    AND slug IS NOT NULL AND slug != ''
    AND owner_token_hash IS NOT NULL AND owner_token_hash != ''
  );

COMMENT ON POLICY "quotes_insert" ON api.quotes IS
  'Defence in depth. Direct INSERT is revoked from authenticated (see this '
  'migration); if it is ever re-granted, rows must still be self-attributed. '
  'All application writes go through /api/quotes under service_role.';

-- ============================================
-- 2. Revoke direct write access from authenticated
-- ============================================
-- SELECT stays: lib/supabase/quotes.ts getQuoteByIdFromSupabase reads the
-- table directly, gated by the quotes_select_by_ownership policy (014).
REVOKE INSERT, UPDATE, DELETE ON api.quotes FROM authenticated;

-- anon never had table grants, but make the intent explicit and idempotent.
REVOKE ALL ON api.quotes FROM anon;
GRANT SELECT ON api.quotes TO authenticated;
