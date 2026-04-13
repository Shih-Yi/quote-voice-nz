-- Migration: Fix save_quote_anon to remove GENERATED ALWAYS columns
--
-- PROBLEM: Migration 004 created save_quote_anon with subtotal, gst, total
-- parameters and included them in INSERT/UPDATE. These are GENERATED ALWAYS
-- columns computed by the database from items_sum + gst_inclusive.
-- PostgreSQL rejects any INSERT/UPDATE that targets GENERATED ALWAYS columns.
--
-- FIX: Recreate the function without subtotal, gst, total parameters.

CREATE OR REPLACE FUNCTION api.save_quote_anon(
  p_id UUID,
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
  p_items_sum NUMERIC(10,2) DEFAULT 0,
  -- subtotal, gst, total are GENERATED ALWAYS columns — computed by the database
  p_status TEXT DEFAULT 'draft'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_token_hash TEXT;
BEGIN
  IF p_customer_name IS NULL OR p_customer_name = '' THEN
    RAISE EXCEPTION 'customer_name is required';
  END IF;
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'token is required';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('draft', 'sent', 'accepted') THEN
    RAISE EXCEPTION 'Invalid status value: %', p_status;
  END IF;

  v_token_hash := api.hash_token(p_token);
  PERFORM api.check_rate_limit(v_token_hash, 'create_quote');

  -- Upsert: INSERT if new, UPDATE if exists (only if token matches)
  INSERT INTO api.quotes (
    id, owner_token_hash, slug,
    customer_name, customer_phone, customer_email, customer_address,
    provider_details, items, notes, gst_inclusive, items_sum,
    status
  ) VALUES (
    p_id, v_token_hash, p_slug,
    p_customer_name, p_customer_phone, p_customer_email, p_customer_address,
    p_provider_details, p_items, p_notes, p_gst_inclusive, p_items_sum,
    p_status
  )
  ON CONFLICT (id) DO UPDATE SET
    customer_name = EXCLUDED.customer_name,
    customer_phone = EXCLUDED.customer_phone,
    customer_email = EXCLUDED.customer_email,
    customer_address = EXCLUDED.customer_address,
    provider_details = EXCLUDED.provider_details,
    items = EXCLUDED.items,
    notes = EXCLUDED.notes,
    gst_inclusive = EXCLUDED.gst_inclusive,
    items_sum = EXCLUDED.items_sum,
    status = EXCLUDED.status,
    updated_at = NOW()
  WHERE api.quotes.owner_token_hash = v_token_hash;

  RETURN FOUND;
END;
$$;

-- Drop old function signature (with subtotal/gst/total params) if it exists
DROP FUNCTION IF EXISTS api.save_quote_anon(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);

-- Grant execute on new signature
GRANT EXECUTE ON FUNCTION api.save_quote_anon(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, BOOLEAN, NUMERIC, TEXT) TO anon, authenticated;
