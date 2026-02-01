-- KiwiSpeakQuote Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- QUOTES TABLE (Dedicated API Schema)
-- Note: This creates a real TABLE in api schema, not a VIEW
-- RLS policies work on tables (not views)
-- ============================================

-- Ensure the schema exists first
CREATE SCHEMA IF NOT EXISTS api;

CREATE TABLE IF NOT EXISTS api.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  owner_token TEXT NOT NULL,  -- For anonymous edit/delete (before registration)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- Linked user (after registration)

  -- Customer info
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,

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

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quotes_slug ON api.quotes(slug);
CREATE INDEX IF NOT EXISTS idx_quotes_owner_token ON api.quotes(owner_token);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON api.quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON api.quotes(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================
ALTER TABLE api.quotes ENABLE ROW LEVEL SECURITY;

-- Anyone can VIEW quotes (for public sharing via slug)
CREATE POLICY "quotes_public_read"
  ON api.quotes FOR SELECT
  USING (true);

-- Anyone can INSERT (anonymous users create quotes)
CREATE POLICY "quotes_insert"
  ON api.quotes FOR INSERT
  WITH CHECK (true);

-- UPDATE: Authenticated user who owns it
CREATE POLICY "quotes_update"
  ON api.quotes FOR UPDATE
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- DELETE: Authenticated user who owns it
CREATE POLICY "quotes_delete"
  ON api.quotes FOR DELETE
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- ============================================
-- SECURE ANONYMOUS OPERATIONS (RPC)
-- ============================================

-- Secure Update: Requires matching owner_token
CREATE OR REPLACE FUNCTION api.update_quote_anon(
  p_id UUID,
  p_token TEXT,
  p_payload JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE api.quotes
  SET 
    customer_name = (p_payload->>'customer_name'),
    customer_phone = (p_payload->>'customer_phone'),
    customer_email = (p_payload->>'customer_email'),
    customer_address = (p_payload->>'customer_address'),
    items = (p_payload->'items'),
    notes = (p_payload->>'notes'),
    gst_inclusive = (p_payload->>'gst_inclusive')::boolean,
    items_sum = (p_payload->>'items_sum')::numeric,
    status = (p_payload->>'status'),
    updated_at = NOW()
  WHERE id = p_id AND owner_token = p_token;

  RETURN FOUND;
END;
$$;

-- Secure Delete: Requires matching owner_token
CREATE OR REPLACE FUNCTION api.delete_quote_anon(
  p_id UUID,
  p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM api.quotes
  WHERE id = p_id AND owner_token = p_token;

  RETURN FOUND;
END;
$$;

-- ============================================
-- FUNCTION: Bind all quotes from device to user (single token)
-- Called after user registers/logs in
-- ============================================
CREATE OR REPLACE FUNCTION api.bind_device_quotes_to_user(
  p_device_token TEXT,
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Bind all quotes with this device token to the user
  UPDATE api.quotes
  SET user_id = p_user_id,
      updated_at = NOW()
  WHERE owner_token = p_device_token
    AND (user_id IS NULL OR user_id = p_user_id);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated;
END;
$$;

-- ============================================
-- FUNCTION: Count quotes by device token
-- For showing "This device has X quotes" prompt
-- ============================================
CREATE OR REPLACE FUNCTION api.count_device_quotes(
  p_device_token TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM api.quotes
  WHERE owner_token = p_device_token;

  RETURN v_count;
END;
$$;

-- ============================================
-- FUNCTION: Get quotes by device token
-- For listing user's quotes before login
-- ============================================
CREATE OR REPLACE FUNCTION api.get_device_quotes(
  p_device_token TEXT
)
RETURNS SETOF api.quotes
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM api.quotes
  WHERE owner_token = p_device_token
  ORDER BY created_at DESC;
END;
$$;

-- ============================================
-- AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION api.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
  business_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  bank_account TEXT,  -- NZ format: XX-XXXX-XXXXXXX-XX
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE api.profiles ENABLE ROW LEVEL SECURITY;

-- Allow public read access (so customers can see business info on quotes)
CREATE POLICY "profiles_read_public"
  ON api.profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_insert_own"
  ON api.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON api.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- PERMISSIONS
-- Grant access to custom schema for Supabase roles
-- ============================================
GRANT USAGE ON SCHEMA api TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA api TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA api TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA api TO anon, authenticated, service_role;
