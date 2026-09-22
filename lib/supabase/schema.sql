-- QuoteTalk Database Schema
-- Run this in Supabase SQL Editor
--
-- SECURITY NOTES:
-- 1. owner_token is stored as SHA-256 hash (never plaintext)
-- 2. RLS policies restrict access based on ownership
-- 3. SECURITY DEFINER functions use explicit search_path
-- 4. Bank account info is only visible to profile owner
-- ============================================

-- ============================================
-- QUOTES TABLE (Dedicated API Schema)
-- Note: This creates a real TABLE in api schema, not a VIEW
-- RLS policies work on tables (not views)
-- ============================================

-- Ensure the schema exists first
CREATE SCHEMA IF NOT EXISTS api;

-- Extension for hashing (if not exists)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- RATE LIMITING SYSTEM
-- Prevents abuse by limiting API calls per identifier
-- ============================================

-- Table to track rate limit entries
CREATE TABLE IF NOT EXISTS api.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,        -- Hashed token or IP address
  action TEXT NOT NULL,            -- Function name being rate limited
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON api.rate_limits(identifier, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup
  ON api.rate_limits(created_at);

-- Rate limit configuration (requests per minute)
-- Stored as a simple key-value for easy adjustment
CREATE TABLE IF NOT EXISTS api.rate_limit_config (
  action TEXT PRIMARY KEY,
  max_requests INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL DEFAULT 60
);

-- Default rate limits
INSERT INTO api.rate_limit_config (action, max_requests, window_seconds) VALUES
  ('create_quote', 10, 60),         -- 10 quotes per minute (prevent spam)
  ('update_quote_anon', 30, 60),    -- 30 updates per minute (allow frequent saves)
  ('delete_quote_anon', 10, 60),    -- 10 deletes per minute
  ('get_quote_by_slug', 60, 60),    -- 60 reads per minute (higher for public access)
  ('get_device_quotes', 30, 60),    -- 30 list requests per minute
  ('bind_device_quotes', 5, 60)     -- 5 binds per minute (sensitive operation)
ON CONFLICT (action) DO NOTHING;

-- ============================================
-- FUNCTION: Check and enforce rate limit
-- Returns TRUE if allowed, raises exception if blocked
-- ============================================
CREATE OR REPLACE FUNCTION api.check_rate_limit(
  p_identifier TEXT,
  p_action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_config RECORD;
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  -- Get rate limit config for this action
  SELECT max_requests, window_seconds INTO v_config
  FROM api.rate_limit_config
  WHERE action = p_action;

  -- If no config found, allow by default (fail open for unconfigured actions)
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  -- Calculate window start time
  v_window_start := NOW() - (v_config.window_seconds || ' seconds')::INTERVAL;

  -- Count recent requests
  SELECT COUNT(*) INTO v_count
  FROM api.rate_limits
  WHERE identifier = p_identifier
    AND action = p_action
    AND created_at > v_window_start;

  -- Check if over limit
  IF v_count >= v_config.max_requests THEN
    RAISE EXCEPTION 'Rate limit exceeded for %. Please wait before trying again.', p_action
      USING ERRCODE = 'P0001';
  END IF;

  -- Record this request
  INSERT INTO api.rate_limits (identifier, action)
  VALUES (p_identifier, p_action);

  RETURN TRUE;
END;
$$;

-- ============================================
-- FUNCTION: Cleanup old rate limit entries
-- Should be called periodically (e.g., via pg_cron)
-- ============================================
CREATE OR REPLACE FUNCTION api.cleanup_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  -- Delete entries older than 1 hour (well beyond any window)
  DELETE FROM api.rate_limits
  WHERE created_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE TABLE IF NOT EXISTS api.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  owner_token_hash TEXT NOT NULL,  -- SHA-256 hash of device token (NEVER store plaintext)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- Linked user (after registration)

  -- Customer info
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,

  -- Provider info (Snapshot of business details at time of quote)
  provider_details JSONB DEFAULT '{}'::jsonb,

  -- Quote content
  items JSONB NOT NULL DEFAULT '[]',
  notes TEXT,

  -- Pricing (NZD) - Database calculates GST automatically
  -- items_sum: Sum of all line item totals (INPUT from frontend)
  -- If gst_inclusive=false: items_sum is NET (before GST)
  -- If gst_inclusive=true: items_sum is GROSS (including GST)
  gst_inclusive BOOLEAN DEFAULT FALSE,
  items_sum NUMERIC(10, 2) NOT NULL DEFAULT 0,

  -- GENERATED columns - calculated by database, not frontend
  -- subtotal: NET amount (before GST)
  subtotal NUMERIC(10, 2) GENERATED ALWAYS AS (
    CASE
      WHEN gst_inclusive THEN ROUND(items_sum * 20 / 23, 2)
      ELSE items_sum
    END
  ) STORED,

  -- gst: GST amount (15%)
  gst NUMERIC(10, 2) GENERATED ALWAYS AS (
    CASE
      WHEN gst_inclusive THEN ROUND(items_sum * 3 / 23, 2)
      ELSE ROUND(items_sum * 15 / 100, 2)
    END
  ) STORED,

  -- total: GROSS amount (including GST)
  total NUMERIC(10, 2) GENERATED ALWAYS AS (
    CASE
      WHEN gst_inclusive THEN items_sum
      ELSE ROUND(items_sum * 115 / 100, 2)
    END
  ) STORED,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted')),

  -- Version tracking (for revisions)
  parent_id UUID REFERENCES api.quotes(id) ON DELETE SET NULL,  -- Original quote if this is a revision
  version INTEGER NOT NULL DEFAULT 1,  -- Version number (1, 2, 3...)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quotes_slug ON api.quotes(slug);
CREATE INDEX IF NOT EXISTS idx_quotes_owner_token_hash ON api.quotes(owner_token_hash);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON api.quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON api.quotes(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================
ALTER TABLE api.quotes ENABLE ROW LEVEL SECURITY;

-- Authenticated users can VIEW their own quotes
-- For public access via slug, use api.get_quote_by_slug() function
CREATE POLICY "quotes_select_own"
  ON api.quotes FOR SELECT
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- INSERT: Anyone can create quotes, but must provide valid data
-- Rate limiting should be implemented at the application/API gateway level
CREATE POLICY "quotes_insert"
  ON api.quotes FOR INSERT
  WITH CHECK (
    -- Ensure required fields are provided
    customer_name IS NOT NULL AND customer_name != ''
    AND slug IS NOT NULL AND slug != ''
    AND owner_token_hash IS NOT NULL AND owner_token_hash != ''
  );

-- UPDATE: Authenticated user who owns it
CREATE POLICY "quotes_update"
  ON api.quotes FOR UPDATE
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- DELETE: Only allow deleting DRAFT quotes that have NO children (versions)
-- This protects version chain integrity
CREATE POLICY "quotes_delete"
  ON api.quotes FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND status = 'draft'
    AND NOT EXISTS (
      SELECT 1 FROM api.quotes children
      WHERE children.parent_id = api.quotes.id
    )
  );

-- ============================================
-- HELPER FUNCTION: Hash token using SHA-256
-- ============================================
CREATE OR REPLACE FUNCTION api.hash_token(p_token TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT encode(digest(p_token, 'sha256'), 'hex')
$$;

-- ============================================
-- FUNCTION: Get quote by slug (PUBLIC ACCESS)
-- This is the ONLY way to access quotes publicly
-- Returns quote data without sensitive fields
-- Includes rate limiting to prevent enumeration attacks
-- ============================================
CREATE OR REPLACE FUNCTION api.get_quote_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  provider_details JSONB,
  items JSONB,
  notes TEXT,
  gst_inclusive BOOLEAN,
  items_sum NUMERIC(10, 2),
  subtotal NUMERIC(10, 2),
  gst NUMERIC(10, 2),
  total NUMERIC(10, 2),
  status TEXT,
  version INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_client_ip TEXT;
BEGIN
  -- Get client IP for rate limiting (falls back to 'anonymous' if not available)
  v_client_ip := COALESCE(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'x-real-ip',
    'anonymous'
  );

  -- Check rate limit using IP address (for public access)
  PERFORM api.check_rate_limit(api.hash_token(v_client_ip), 'get_quote_by_slug');

  -- Only return quotes that have been sent (not drafts)
  -- This prevents accessing work-in-progress quotes
  RETURN QUERY
  SELECT
    q.id, q.slug,
    q.customer_name, q.customer_phone, q.customer_email, q.customer_address,
    q.provider_details, q.items, q.notes,
    q.gst_inclusive, q.items_sum, q.subtotal, q.gst, q.total,
    q.status, q.version, q.created_at
  FROM api.quotes q
  WHERE q.slug = p_slug
    AND q.status IN ('sent', 'accepted');  -- Only published quotes
END;
$$;

-- ============================================
-- FUNCTION: Create quote with hashed token
-- Handles token hashing server-side for security
-- Includes rate limiting to prevent spam
-- ============================================
CREATE OR REPLACE FUNCTION api.create_quote(
  p_token TEXT,  -- Plaintext device token (will be hashed)
  p_slug TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_address TEXT DEFAULT NULL,
  p_provider_details JSONB DEFAULT '{}'::jsonb,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_notes TEXT DEFAULT NULL,
  p_gst_inclusive BOOLEAN DEFAULT FALSE,
  p_items_sum NUMERIC(10, 2) DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_token_hash TEXT;
  v_id UUID;
BEGIN
  -- Validate required fields
  IF p_customer_name IS NULL OR p_customer_name = '' THEN
    RAISE EXCEPTION 'customer_name is required';
  END IF;

  IF p_slug IS NULL OR p_slug = '' THEN
    RAISE EXCEPTION 'slug is required';
  END IF;

  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'token is required';
  END IF;

  -- Hash the token server-side
  v_token_hash := api.hash_token(p_token);

  -- Check rate limit (uses hashed token as identifier)
  PERFORM api.check_rate_limit(v_token_hash, 'create_quote');

  INSERT INTO api.quotes (
    owner_token_hash,
    slug,
    customer_name,
    customer_phone,
    customer_email,
    customer_address,
    provider_details,
    items,
    notes,
    gst_inclusive,
    items_sum
  ) VALUES (
    v_token_hash,
    p_slug,
    p_customer_name,
    p_customer_phone,
    p_customer_email,
    p_customer_address,
    p_provider_details,
    p_items,
    p_notes,
    p_gst_inclusive,
    p_items_sum
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================
-- SECURE ANONYMOUS OPERATIONS (RPC)
-- All functions use SECURITY DEFINER with explicit search_path
-- to prevent search_path injection attacks
-- ============================================

-- Secure Update: Requires matching owner_token (hashed)
-- Includes rate limiting to prevent abuse
CREATE OR REPLACE FUNCTION api.update_quote_anon(
  p_id UUID,
  p_token TEXT,  -- Plaintext token from client (will be hashed for comparison)
  p_payload JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_token_hash TEXT;
  v_status TEXT;
BEGIN
  -- Hash the provided token for comparison
  v_token_hash := api.hash_token(p_token);

  -- Check rate limit
  PERFORM api.check_rate_limit(v_token_hash, 'update_quote_anon');

  -- Validate status if provided
  v_status := p_payload->>'status';
  IF v_status IS NOT NULL AND v_status NOT IN ('draft', 'sent', 'accepted') THEN
    RAISE EXCEPTION 'Invalid status value: %', v_status;
  END IF;

  -- Validate customer_name is not empty
  IF (p_payload->>'customer_name') IS NOT NULL AND (p_payload->>'customer_name') = '' THEN
    RAISE EXCEPTION 'customer_name cannot be empty';
  END IF;

  UPDATE api.quotes
  SET
    customer_name = COALESCE(p_payload->>'customer_name', customer_name),
    customer_phone = COALESCE(p_payload->>'customer_phone', customer_phone),
    customer_email = COALESCE(p_payload->>'customer_email', customer_email),
    customer_address = COALESCE(p_payload->>'customer_address', customer_address),
    provider_details = COALESCE(p_payload->'provider_details', provider_details),
    items = COALESCE(p_payload->'items', items),
    notes = COALESCE(p_payload->>'notes', notes),
    gst_inclusive = COALESCE((p_payload->>'gst_inclusive')::boolean, gst_inclusive),
    items_sum = COALESCE((p_payload->>'items_sum')::numeric, items_sum),
    status = COALESCE(v_status, status),
    updated_at = NOW()
  WHERE id = p_id AND owner_token_hash = v_token_hash;

  RETURN FOUND;
END;
$$;

-- Secure Delete: Requires matching owner_token (hashed)
-- Only allows deleting DRAFT quotes without children (versions)
-- Includes rate limiting to prevent abuse
CREATE OR REPLACE FUNCTION api.delete_quote_anon(
  p_id UUID,
  p_token TEXT  -- Plaintext token from client (will be hashed for comparison)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_token_hash TEXT;
BEGIN
  -- Hash the provided token for comparison
  v_token_hash := api.hash_token(p_token);

  -- Check rate limit
  PERFORM api.check_rate_limit(v_token_hash, 'delete_quote_anon');

  -- Only delete if: draft status AND no children (versions)
  DELETE FROM api.quotes
  WHERE id = p_id
    AND owner_token_hash = v_token_hash
    AND status = 'draft'
    AND NOT EXISTS (
      SELECT 1 FROM api.quotes children
      WHERE children.parent_id = p_id
    );

  RETURN FOUND;
END;
$$;

-- ============================================
-- FUNCTION: Bind all quotes from device to user (single token)
-- Called after user registers/logs in
-- SECURITY: Only the authenticated user can bind quotes to themselves
-- Includes rate limiting (sensitive operation)
-- ============================================
CREATE OR REPLACE FUNCTION api.bind_device_quotes_to_user(
  p_device_token TEXT  -- Plaintext token from client (will be hashed for comparison)
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_updated INTEGER;
  v_token_hash TEXT;
  v_user_id UUID;
BEGIN
  -- Get the authenticated user's ID (prevents binding to arbitrary users)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Hash the provided token for comparison
  v_token_hash := api.hash_token(p_device_token);

  -- Check rate limit (use user_id for authenticated operations)
  PERFORM api.check_rate_limit(v_user_id::TEXT, 'bind_device_quotes');

  -- Bind all quotes with this device token to the authenticated user
  UPDATE api.quotes
  SET user_id = v_user_id,
      updated_at = NOW()
  WHERE owner_token_hash = v_token_hash
    AND (user_id IS NULL OR user_id = v_user_id);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- SMART ONBOARDING:
  -- If the user has no profile set up yet, try to populate it
  -- using the provider_details from their most recent anonymous quote.
  INSERT INTO api.profiles (id, business_name, phone, email, address, bank_account)
  SELECT
    v_user_id,
    q.provider_details->>'businessName',
    q.provider_details->>'phone',
    q.provider_details->>'email',
    q.provider_details->>'address',
    q.provider_details->>'bankAccount'
  FROM api.quotes q
  WHERE q.owner_token_hash = v_token_hash
    AND q.provider_details IS NOT NULL
    AND q.provider_details != '{}'::jsonb
  ORDER BY q.created_at DESC
  LIMIT 1
  ON CONFLICT (id) DO NOTHING; -- Don't overwrite if they already set up a profile via other means

  RETURN v_updated;
END;
$$;

-- ============================================
-- FUNCTION: Count quotes by device token
-- For showing "This device has X quotes" prompt
-- ============================================
CREATE OR REPLACE FUNCTION api.count_device_quotes(
  p_device_token TEXT  -- Plaintext token from client (will be hashed for comparison)
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_count INTEGER;
  v_token_hash TEXT;
BEGIN
  -- Hash the provided token for comparison
  v_token_hash := api.hash_token(p_device_token);

  SELECT COUNT(*) INTO v_count
  FROM api.quotes
  WHERE owner_token_hash = v_token_hash;

  RETURN v_count;
END;
$$;

-- ============================================
-- FUNCTION: Get quotes by device token
-- For listing user's quotes before login
-- NOTE: Returns quotes without exposing owner_token_hash
-- Includes rate limiting
-- ============================================
CREATE OR REPLACE FUNCTION api.get_device_quotes(
  p_device_token TEXT  -- Plaintext token from client (will be hashed for comparison)
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  user_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  provider_details JSONB,
  items JSONB,
  notes TEXT,
  gst_inclusive BOOLEAN,
  items_sum NUMERIC(10, 2),
  subtotal NUMERIC(10, 2),
  gst NUMERIC(10, 2),
  total NUMERIC(10, 2),
  status TEXT,
  parent_id UUID,
  version INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_token_hash TEXT;
BEGIN
  -- Hash the provided token for comparison
  v_token_hash := api.hash_token(p_device_token);

  -- Check rate limit
  PERFORM api.check_rate_limit(v_token_hash, 'get_device_quotes');

  RETURN QUERY
  SELECT
    q.id, q.slug, q.user_id,
    q.customer_name, q.customer_phone, q.customer_email, q.customer_address,
    q.provider_details, q.items, q.notes,
    q.gst_inclusive, q.items_sum, q.subtotal, q.gst, q.total,
    q.status, q.parent_id, q.version,
    q.created_at, q.updated_at
  FROM api.quotes q
  WHERE q.owner_token_hash = v_token_hash
  ORDER BY q.created_at DESC;
END;
$$;

-- ============================================
-- AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION api.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = api, public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_updated_at ON api.quotes;
CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON api.quotes
  FOR EACH ROW
  EXECUTE FUNCTION api.update_updated_at_column();

-- ============================================
-- USER PROFILES TABLE (optional, for future use)
-- ============================================
CREATE TABLE IF NOT EXISTS api.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,     -- From OAuth provider (e.g., Google)
  avatar_url TEXT,    -- From OAuth provider
  business_name TEXT, -- User-editable trading name
  phone TEXT,
  email TEXT,
  address TEXT,
  bank_account TEXT,  -- NZ format: XX-XXXX-XXXXXXX-XX (SENSITIVE - owner only)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE api.profiles ENABLE ROW LEVEL SECURITY;

-- Owner can see their full profile (including bank_account)
CREATE POLICY "profiles_select_own"
  ON api.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON api.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON api.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- FUNCTION: Get public profile by user_id
-- For displaying business info on shared quotes
-- ============================================
CREATE OR REPLACE FUNCTION api.get_public_profile(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  business_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.business_name, p.phone, p.email, p.address
  FROM api.profiles p
  WHERE p.id = p_user_id;
END;
$$;

-- ============================================
-- PERMISSIONS
-- Grant access to custom schema for Supabase roles
-- Principle of least privilege: anon has minimal access
-- ============================================
GRANT USAGE ON SCHEMA api TO anon, authenticated, service_role;

-- ANON role: Minimal permissions (public access)
-- Can only SELECT quotes via RPC functions (not direct table access)
-- Can execute specific RPC functions for anonymous operations
GRANT EXECUTE ON FUNCTION api.hash_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION api.create_quote(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, BOOLEAN, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION api.get_quote_by_slug(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION api.update_quote_anon(UUID, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION api.delete_quote_anon(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION api.count_device_quotes(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION api.get_device_quotes(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION api.get_public_profile(UUID) TO anon;

-- AUTHENTICATED role: Full access to own data (controlled by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON api.quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON api.profiles TO authenticated;
GRANT EXECUTE ON FUNCTION api.hash_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api.create_quote(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, BOOLEAN, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION api.get_quote_by_slug(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api.update_quote_anon(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION api.delete_quote_anon(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api.count_device_quotes(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api.get_device_quotes(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api.bind_device_quotes_to_user(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api.get_public_profile(UUID) TO authenticated;

-- SERVICE_ROLE: Full access (for admin/backend operations)
GRANT ALL ON ALL TABLES IN SCHEMA api TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA api TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA api TO service_role;

-- ============================================
-- RATE LIMIT TABLE PERMISSIONS
-- No direct table access for anon/authenticated — all operations
-- go through SECURITY DEFINER functions (check_rate_limit, cleanup_rate_limits)
-- which bypass RLS and run as the function owner.
-- ============================================
ALTER TABLE api.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE api.rate_limit_config ENABLE ROW LEVEL SECURITY;

-- service_role: full access for admin/cleanup operations
CREATE POLICY "service_role_rate_limits_select" ON api.rate_limits FOR SELECT TO service_role USING (true);
CREATE POLICY "service_role_rate_limits_insert" ON api.rate_limits FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "service_role_rate_limits_delete" ON api.rate_limits FOR DELETE TO service_role USING (true);

CREATE POLICY "service_role_rate_limit_config_select" ON api.rate_limit_config FOR SELECT TO service_role USING (true);
CREATE POLICY "service_role_rate_limit_config_insert" ON api.rate_limit_config FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "service_role_rate_limit_config_update" ON api.rate_limit_config FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_rate_limit_config_delete" ON api.rate_limit_config FOR DELETE TO service_role USING (true);

-- Revoke direct table access from anon/authenticated
-- (all operations go through SECURITY DEFINER RPC functions)
REVOKE SELECT, INSERT, DELETE ON api.rate_limits FROM anon, authenticated;
REVOKE SELECT ON api.rate_limit_config FROM anon, authenticated;

-- RPC function execution grants (functions bypass RLS internally)
GRANT EXECUTE ON FUNCTION api.check_rate_limit(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION api.cleanup_rate_limits() TO service_role;

-- ============================================
-- WAITLIST TABLE RLS
-- All access goes through service_role key in API routes
-- anon/authenticated have no direct access
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'api' AND table_name = 'waitlist'
  ) THEN
    EXECUTE 'ALTER TABLE api.waitlist ENABLE ROW LEVEL SECURITY';

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

    EXECUTE 'REVOKE ALL ON api.waitlist FROM anon, authenticated';
  END IF;
END;
$$;
