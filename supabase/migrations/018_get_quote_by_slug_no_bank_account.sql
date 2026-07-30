-- Stop returning the owner's bank account on public quote links.
--
-- PROBLEM
-- Migration 011 added owner_bank_account to api.get_quote_by_slug, which is
-- SECURITY DEFINER and granted to anon. Its comment justified this as "already
-- embedded in provider_details for paid quotes" — but the column was returned
-- unconditionally, for every quote and every tier. lib/supabase/quotes.ts
-- merged it into ownerProfile, and components/quote/QuotePDF.tsx renders it as
-- "Bank: <account>" into the downloadable PDF. So anyone the share link was
-- forwarded to received the tradie's bank account number, whether or not the
-- tradie ever chose to put it on that quote.
--
-- A quote is not an invoice. Payment details belong on the document the
-- customer pays against, after acceptance — not on every quote that goes out.
--
-- FIX
-- Drop owner_bank_account from the RPC's result. Everything else the customer
-- needs to identify and contact the tradie (business name, phone, email,
-- address) is retained.
--
-- NOT AFFECTED: quotes.provider_details. That JSONB column is a per-quote
-- snapshot the tradie fills in deliberately via QuoteForm (handleProviderUpdate),
-- and may legitimately contain bankAccount because putting it there is an
-- explicit, per-quote choice. This migration only removes the *automatic* join
-- from api.profiles, which the tradie never opted into.
-- ============================================

DROP FUNCTION IF EXISTS api.get_quote_by_slug(TEXT);

CREATE OR REPLACE FUNCTION api.get_quote_by_slug(p_slug TEXT)
RETURNS TABLE (
  id UUID, slug TEXT,
  user_id UUID,
  customer_name TEXT, customer_phone TEXT, customer_email TEXT, customer_address TEXT,
  provider_details JSONB, items JSONB, notes TEXT,
  gst_inclusive BOOLEAN, items_sum NUMERIC(10, 2),
  subtotal NUMERIC(10, 2), gst NUMERIC(10, 2), total NUMERIC(10, 2),
  status TEXT, parent_id UUID, version INTEGER,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  owner_business_name TEXT,
  owner_phone TEXT,
  owner_email TEXT,
  owner_address TEXT,
  owner_subscription_tier TEXT
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
    q.status, q.parent_id, q.version, q.created_at, q.updated_at,
    p.business_name, p.phone, p.email, p.address,
    COALESCE(p.subscription_tier, 'free')
  FROM api.quotes q
  LEFT JOIN api.profiles p ON p.id = q.user_id
  WHERE q.slug = p_slug
    AND q.status IN ('sent', 'accepted');
END;
$$;

COMMENT ON FUNCTION api.get_quote_by_slug(TEXT) IS
  'Public quote lookup for /q/[slug]. Returns sent/accepted rows only. Owner '
  'bank account is deliberately NOT returned — see migration 018.';

GRANT EXECUTE ON FUNCTION api.get_quote_by_slug(TEXT) TO anon, authenticated;
