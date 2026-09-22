-- Migration 020: Fix transcribe_quota and RPC function to use 'api' schema
--
-- PROBLEM:
-- Migration 012 originally created `transcribe_quota` and `increment_transcribe_quota_if_allowed`
-- without schema qualification, causing them to reside in the default `public` schema.
-- However, Next.js server code (`lib/supabase/server.ts`) configures the Supabase client
-- with `db: { schema: 'api' }`.
--
-- SYMPTOM:
-- Calls to `supabase.rpc("increment_transcribe_quota_if_allowed")` failed with:
--   "[costGuard] RPC error: Could not find the function api.increment_transcribe_quota_if_allowed(...) in the schema cache"
-- Because `costGuard.ts` implements a fail-closed policy for the global transcribe cap,
-- any RPC error causes `/api/transcribe` to reject requests with 503 "daily_capacity_reached".
--
-- FIX:
-- 1. Ensure `api` schema exists.
-- 2. Create `api.transcribe_quota` table with updated QuotaScope constraint ('quote_device', 'quote_ip').
-- 3. Idempotently recreate RLS policy (DROP IF EXISTS to avoid error 42710).
-- 4. Explicitly grant permissions on `api.transcribe_quota` to `service_role`.
-- 5. Create `api.increment_transcribe_quota_if_allowed` function under `api` schema.
-- 6. Grant execute permissions on function to `service_role`.
-- 7. Migrate legacy usage records from `public.transcribe_quota` if present.
-- 8. Notify PostgREST to reload schema cache.
-- ==============================================================================

-- Step 1: Ensure api schema exists
CREATE SCHEMA IF NOT EXISTS api;

-- Step 2: Create transcribe_quota in api schema
CREATE TABLE IF NOT EXISTS api.transcribe_quota (
  scope text NOT NULL CHECK (scope IN ('global', 'device', 'ip', 'user', 'quote_device', 'quote_ip')),
  identifier text NOT NULL,
  usage_date date NOT NULL,
  count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, identifier, usage_date)
);

CREATE INDEX IF NOT EXISTS transcribe_quota_date_scope_idx
  ON api.transcribe_quota (usage_date DESC, scope);

ALTER TABLE api.transcribe_quota ENABLE ROW LEVEL SECURITY;

-- Step 3: RLS policy (service_role bypasses RLS; deny authenticated and anon)
DROP POLICY IF EXISTS "transcribe_quota_no_client_access" ON api.transcribe_quota;

CREATE POLICY "transcribe_quota_no_client_access"
  ON api.transcribe_quota
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- Step 4: Grant table privileges to service_role
GRANT ALL ON api.transcribe_quota TO service_role;

-- Step 5: Atomic check-and-increment RPC function in api schema
CREATE OR REPLACE FUNCTION api.increment_transcribe_quota_if_allowed(
  p_scope text,
  p_identifier text,
  p_date date,
  p_limit int
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO api.transcribe_quota (scope, identifier, usage_date, count)
  VALUES (p_scope, p_identifier, p_date, 0)
  ON CONFLICT (scope, identifier, usage_date) DO NOTHING;

  UPDATE api.transcribe_quota
    SET count = count + 1,
        updated_at = now()
    WHERE scope = p_scope
      AND identifier = p_identifier
      AND usage_date = p_date
      AND count < p_limit
    RETURNING count INTO v_count;

  IF v_count IS NULL THEN
    RETURN -1;
  END IF;

  RETURN v_count;
END;
$$;

-- Step 6: Grant execution permission to service_role
GRANT EXECUTE ON FUNCTION api.increment_transcribe_quota_if_allowed(text, text, date, int) TO service_role;

-- Step 7: Safely migrate legacy data from public.transcribe_quota if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'transcribe_quota'
  ) THEN
    INSERT INTO api.transcribe_quota (scope, identifier, usage_date, count, updated_at)
    SELECT scope, identifier, usage_date, count, updated_at 
    FROM public.transcribe_quota
    ON CONFLICT (scope, identifier, usage_date) DO NOTHING;
  END IF;
END $$;

-- Step 8: Documentation comments
COMMENT ON TABLE api.transcribe_quota IS
  'Daily quota counters for /api/transcribe and costGuard. Enforced via api.increment_transcribe_quota_if_allowed.';
COMMENT ON FUNCTION api.increment_transcribe_quota_if_allowed IS
  'Atomic check-and-increment for quota enforcement. Returns new count, or -1 when exceeding limit.';

-- Step 9: Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
