-- Migration: Fix pgcrypto schema path for digest() function
-- Run this in Supabase SQL Editor
--
-- FIXES: "function digest(text, unknown) does not exist" error
-- Supabase installs pgcrypto in the 'extensions' schema by default,
-- but hash_token() couldn't find it. This ensures pgcrypto is also
-- available in 'public' and updates the search_path accordingly.
-- ============================================

-- Ensure pgcrypto is available in public schema
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;

-- Rebuild hash_token with correct search_path
CREATE OR REPLACE FUNCTION api.hash_token(p_token TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, extensions
AS $$
  SELECT encode(digest(p_token, 'sha256'), 'hex')
$$;
