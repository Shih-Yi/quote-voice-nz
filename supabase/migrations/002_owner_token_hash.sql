-- Migration: owner_token (plaintext) → owner_token_hash (SHA-256)
-- Run this in Supabase SQL Editor
--
-- WHAT THIS DOES:
-- 1. Enables pgcrypto extension (for SHA-256 hashing)
-- 2. Adds owner_token_hash column
-- 3. Backfills existing plaintext tokens → SHA-256 hashes
-- 4. Makes owner_token_hash NOT NULL
-- 5. Drops old owner_token column
-- 6. Creates index on owner_token_hash
-- 7. Creates/updates all RPC functions that use owner_token_hash
-- 8. Updates RLS policies
-- 9. Grants permissions
--
-- IMPORTANT: This is a ONE-WAY migration. After running, plaintext tokens are gone.
-- ============================================

-- Step 0: Ensure pgcrypto is available in public schema
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;

-- Step 1: Ensure api schema exists
CREATE SCHEMA IF NOT EXISTS api;

-- ============================================
-- Step 2: Hash token helper function
-- ============================================
CREATE OR REPLACE FUNCTION api.hash_token(p_token TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, extensions
AS $$
  SELECT encode(digest(p_token, 'sha256'), 'hex')
$$;

-- ============================================
-- Step 3: Migrate owner_token → owner_token_hash
-- ============================================

-- Add new column (nullable initially for backfill)
ALTER TABLE api.quotes ADD COLUMN IF NOT EXISTS owner_token_hash TEXT;

-- Backfill: hash all existing plaintext tokens
UPDATE api.quotes
SET owner_token_hash = encode(digest(owner_token, 'sha256'), 'hex')
WHERE owner_token IS NOT NULL
  AND (owner_token_hash IS NULL OR owner_token_hash = '');

-- Make NOT NULL after backfill
ALTER TABLE api.quotes ALTER COLUMN owner_token_hash SET NOT NULL;

-- Drop old plaintext column
ALTER TABLE api.quotes DROP COLUMN IF EXISTS owner_token;

-- Create index
CREATE INDEX IF NOT EXISTS idx_quotes_owner_token_hash
  ON api.quotes(owner_token_hash);

-- ============================================
-- Step 4: Rate limiting system (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS api.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON api.rate_limits(identifier, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup
  ON api.rate_limits(created_at);

CREATE TABLE IF NOT EXISTS api.rate_limit_config (
  action TEXT PRIMARY KEY,
  max_requests INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL DEFAULT 60
);

-- Default rate limits (upsert to avoid conflicts)
INSERT INTO api.rate_limit_config (action, max_requests, window_seconds) VALUES
  ('create_quote', 10, 60),
  ('update_quote_anon', 30, 60),
  ('delete_quote_anon', 10, 60),
  ('get_quote_by_slug', 60, 60),
  ('get_device_quotes', 30, 60),
  ('bind_device_quotes', 5, 60)
ON CONFLICT (action) DO NOTHING;

-- Rate limit check function
CREATE OR REPLACE FUNCTION api.check_rate_limit(
  p_identifier TEXT,
  p_action TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_max_requests INTEGER;
  v_window_seconds INTEGER;
  v_current_count INTEGER;
  v_deleted INTEGER;
BEGIN
  SELECT max_requests, window_seconds INTO v_max_requests, v_window_seconds
  FROM api.rate_limit_config
  WHERE action = p_action;

  IF v_max_requests IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM api.rate_limits
  WHERE identifier = p_identifier
    AND action = p_action
    AND created_at < NOW() - (v_window_seconds || ' seconds')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  SELECT COUNT(*) INTO v_current_count
  FROM api.rate_limits
  WHERE identifier = p_identifier
    AND action = p_action
    AND created_at >= NOW() - (v_window_seconds || ' seconds')::INTERVAL;

  IF v_current_count >= v_max_requests THEN
    RAISE EXCEPTION 'Rate limit exceeded for action: %', p_action;
  END IF;

  INSERT INTO api.rate_limits (identifier, action) VALUES (p_identifier, p_action);
END;
$$;

-- ============================================
-- Step 5: RPC Functions (create/update all)
-- Drop first because return types may have changed
-- ============================================
DROP FUNCTION IF EXISTS api.create_quote(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, BOOLEAN, NUMERIC);
DROP FUNCTION IF EXISTS api.update_quote_anon(UUID, TEXT, JSONB);
DROP FUNCTION IF EXISTS api.delete_quote_anon(UUID, TEXT);
DROP FUNCTION IF EXISTS api.get_quote_by_slug(TEXT);
DROP FUNCTION IF EXISTS api.count_device_quotes(TEXT);
DROP FUNCTION IF EXISTS api.get_device_quotes(TEXT);
DROP FUNCTION IF EXISTS api.bind_device_quotes_to_user(TEXT);
-- Also drop old signature if it had p_user_id
DROP FUNCTION IF EXISTS api.bind_device_quotes_to_user(TEXT, UUID);

-- Create quote (anonymous - hashes token server-side)
CREATE OR REPLACE FUNCTION api.create_quote(
  p_token TEXT,
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
  IF p_customer_name IS NULL OR p_customer_name = '' THEN
    RAISE EXCEPTION 'customer_name is required';
  END IF;
  IF p_slug IS NULL OR p_slug = '' THEN
    RAISE EXCEPTION 'slug is required';
  END IF;
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'token is required';
  END IF;

  v_token_hash := api.hash_token(p_token);
  PERFORM api.check_rate_limit(v_token_hash, 'create_quote');

  INSERT INTO api.quotes (
    owner_token_hash, slug,
    customer_name, customer_phone, customer_email, customer_address,
    provider_details, items, notes, gst_inclusive, items_sum
  ) VALUES (
    v_token_hash, p_slug,
    p_customer_name, p_customer_phone, p_customer_email, p_customer_address,
    p_provider_details, p_items, p_notes, p_gst_inclusive, p_items_sum
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Update quote (anonymous - verifies hashed token)
CREATE OR REPLACE FUNCTION api.update_quote_anon(
  p_id UUID,
  p_token TEXT,
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
  v_token_hash := api.hash_token(p_token);
  PERFORM api.check_rate_limit(v_token_hash, 'update_quote_anon');

  v_status := p_payload->>'status';
  IF v_status IS NOT NULL AND v_status NOT IN ('draft', 'sent', 'accepted') THEN
    RAISE EXCEPTION 'Invalid status value: %', v_status;
  END IF;
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

-- Delete quote (anonymous - verifies hashed token, draft only)
CREATE OR REPLACE FUNCTION api.delete_quote_anon(
  p_id UUID,
  p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_token_hash TEXT;
BEGIN
  v_token_hash := api.hash_token(p_token);
  PERFORM api.check_rate_limit(v_token_hash, 'delete_quote_anon');

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

-- Get quote by slug (public access - sent/accepted only)
CREATE OR REPLACE FUNCTION api.get_quote_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID, slug TEXT,
  user_id UUID,
  customer_name TEXT, customer_phone TEXT, customer_email TEXT, customer_address TEXT,
  provider_details JSONB, items JSONB, notes TEXT,
  gst_inclusive BOOLEAN, items_sum NUMERIC(10, 2),
  subtotal NUMERIC(10, 2), gst NUMERIC(10, 2), total NUMERIC(10, 2),
  status TEXT, parent_id UUID, version INTEGER,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_client_ip TEXT;
BEGIN
  v_client_ip := COALESCE(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    current_setting('request.headers', true)::json->>'x-real-ip',
    'anonymous'
  );
  PERFORM api.check_rate_limit(api.hash_token(v_client_ip), 'get_quote_by_slug');

  RETURN QUERY
  SELECT
    q.id, q.slug, q.user_id,
    q.customer_name, q.customer_phone, q.customer_email, q.customer_address,
    q.provider_details, q.items, q.notes,
    q.gst_inclusive, q.items_sum, q.subtotal, q.gst, q.total,
    q.status, q.parent_id, q.version, q.created_at, q.updated_at
  FROM api.quotes q
  WHERE q.slug = p_slug
    AND q.status IN ('sent', 'accepted');
END;
$$;

-- Count quotes by device token
CREATE OR REPLACE FUNCTION api.count_device_quotes(
  p_device_token TEXT
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
  v_token_hash := api.hash_token(p_device_token);
  SELECT COUNT(*) INTO v_count FROM api.quotes WHERE owner_token_hash = v_token_hash;
  RETURN v_count;
END;
$$;

-- Get quotes by device token
CREATE OR REPLACE FUNCTION api.get_device_quotes(
  p_device_token TEXT
)
RETURNS TABLE (
  id UUID, slug TEXT, user_id UUID,
  customer_name TEXT, customer_phone TEXT, customer_email TEXT, customer_address TEXT,
  provider_details JSONB, items JSONB, notes TEXT,
  gst_inclusive BOOLEAN, items_sum NUMERIC(10, 2),
  subtotal NUMERIC(10, 2), gst NUMERIC(10, 2), total NUMERIC(10, 2),
  status TEXT, parent_id UUID, version INTEGER,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_token_hash TEXT;
BEGIN
  v_token_hash := api.hash_token(p_device_token);
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

-- Bind device quotes to user (after login/registration)
CREATE OR REPLACE FUNCTION api.bind_device_quotes_to_user(
  p_device_token TEXT
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
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_token_hash := api.hash_token(p_device_token);
  PERFORM api.check_rate_limit(v_user_id::TEXT, 'bind_device_quotes');

  UPDATE api.quotes
  SET user_id = v_user_id, updated_at = NOW()
  WHERE owner_token_hash = v_token_hash
    AND (user_id IS NULL OR user_id = v_user_id);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Auto-populate profile from most recent anonymous quote
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
  ON CONFLICT (id) DO NOTHING;

  RETURN v_updated;
END;
$$;

-- ============================================
-- Step 6: Update RLS policies
-- ============================================

-- Drop old policies that might reference owner_token
DROP POLICY IF EXISTS "quotes_insert" ON api.quotes;

-- Recreate INSERT policy with owner_token_hash
CREATE POLICY "quotes_insert"
  ON api.quotes FOR INSERT
  WITH CHECK (
    customer_name IS NOT NULL AND customer_name != ''
    AND slug IS NOT NULL AND slug != ''
    AND owner_token_hash IS NOT NULL AND owner_token_hash != ''
  );

-- ============================================
-- Step 7: Grant permissions
-- ============================================
GRANT USAGE ON SCHEMA api TO anon, authenticated, service_role;

-- ANON role
GRANT EXECUTE ON FUNCTION api.hash_token(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION api.create_quote(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, BOOLEAN, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION api.get_quote_by_slug(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION api.update_quote_anon(UUID, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION api.delete_quote_anon(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION api.count_device_quotes(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION api.get_device_quotes(TEXT) TO anon;

-- AUTHENTICATED role
GRANT SELECT, INSERT, UPDATE, DELETE ON api.quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON api.profiles TO authenticated;
GRANT EXECUTE ON FUNCTION api.hash_token(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api.create_quote(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, BOOLEAN, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION api.get_quote_by_slug(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api.update_quote_anon(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION api.delete_quote_anon(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api.count_device_quotes(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION api.get_device_quotes(TEXT) TO authenticated;

-- Rate limit tables
GRANT SELECT, INSERT, DELETE ON api.rate_limits TO anon, authenticated;
GRANT SELECT ON api.rate_limit_config TO anon, authenticated;
