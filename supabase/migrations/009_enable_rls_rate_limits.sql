-- Migration: Enable RLS on rate_limits, rate_limit_config, and waitlist
--
-- PROBLEM: These tables have no RLS enabled, and anon/authenticated roles
-- have direct GRANT privileges on them. This means anyone with the project
-- URL can read, insert, or delete rate limit entries directly — bypassing
-- the SECURITY DEFINER RPC functions that are the intended access path.
--
-- FIX:
-- 1. Enable RLS on rate_limits and rate_limit_config
-- 2. Revoke unnecessary direct table grants from anon/authenticated
-- 3. Add service_role policies (for cleanup_rate_limits and admin ops)
-- 4. Enable RLS on waitlist if it exists
--
-- SAFE because:
-- - All rate limit operations go through SECURITY DEFINER functions
--   (check_rate_limit, cleanup_rate_limits) which run as the function
--   owner (postgres superuser) and bypass RLS entirely.
-- - Waitlist is accessed via service_role key which has BYPASSRLS.
-- - No TypeScript code directly queries these tables.
-- ============================================

-- ============================================
-- 1. api.rate_limits — Enable RLS + revoke direct access
-- ============================================
ALTER TABLE api.rate_limits ENABLE ROW LEVEL SECURITY;

-- service_role: full access (for cleanup_rate_limits and admin)
CREATE POLICY "service_role_rate_limits_select"
  ON api.rate_limits FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "service_role_rate_limits_insert"
  ON api.rate_limits FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_role_rate_limits_delete"
  ON api.rate_limits FOR DELETE
  TO service_role
  USING (true);

-- Revoke direct table access from anon/authenticated
-- (all operations go through SECURITY DEFINER RPC functions)
REVOKE SELECT, INSERT, DELETE ON api.rate_limits FROM anon, authenticated;

-- ============================================
-- 2. api.rate_limit_config — Enable RLS + revoke direct access
-- ============================================
ALTER TABLE api.rate_limit_config ENABLE ROW LEVEL SECURITY;

-- service_role: full access (for admin configuration)
CREATE POLICY "service_role_rate_limit_config_select"
  ON api.rate_limit_config FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "service_role_rate_limit_config_insert"
  ON api.rate_limit_config FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "service_role_rate_limit_config_update"
  ON api.rate_limit_config FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_rate_limit_config_delete"
  ON api.rate_limit_config FOR DELETE
  TO service_role
  USING (true);

-- Revoke direct table access from anon/authenticated
REVOKE SELECT ON api.rate_limit_config FROM anon, authenticated;

-- ============================================
-- 3. api.waitlist — Enable RLS if table exists
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'api' AND table_name = 'waitlist'
  ) THEN
    EXECUTE 'ALTER TABLE api.waitlist ENABLE ROW LEVEL SECURITY';

    -- service_role: full access (waitlist route uses service_role key)
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'api' AND tablename = 'waitlist'
        AND policyname = 'service_role_waitlist_all'
    ) THEN
      EXECUTE 'CREATE POLICY "service_role_waitlist_all"
        ON api.waitlist FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)';
    END IF;

    -- Revoke any direct access from anon/authenticated
    EXECUTE 'REVOKE ALL ON api.waitlist FROM anon, authenticated';
  END IF;
END;
$$;
