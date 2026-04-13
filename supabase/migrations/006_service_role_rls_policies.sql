-- Migration: Add RLS policies for service_role on api.quotes
--
-- PROBLEM: service_role bypasses RLS only when it has the BYPASSRLS attribute
-- AND the PostgREST authenticator role properly delegates it. In Supabase with
-- custom schemas (api), the RLS policies are still enforced against service_role.
--
-- The existing UPDATE policy requires auth.uid() = user_id, but API routes using
-- service_role have no auth session, so UPDATE (and the UPDATE part of upsert)
-- is rejected with error 42501.
--
-- FIX: Add explicit permissive RLS policies for the service_role role.
-- The API route already performs ownership verification (token hash check)
-- before any write operation, so these policies are safe.

-- quotes: service_role can SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "service_role_select"
  ON api.quotes FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "service_role_insert"
  ON api.quotes FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_role_update"
  ON api.quotes FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_delete"
  ON api.quotes FOR DELETE
  TO service_role
  USING (true);

-- profiles: service_role needs access for profile sync
CREATE POLICY "service_role_profiles_select"
  ON api.profiles FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "service_role_profiles_insert"
  ON api.profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_role_profiles_update"
  ON api.profiles FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
