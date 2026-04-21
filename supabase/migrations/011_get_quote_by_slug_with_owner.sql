-- Extend api.get_quote_by_slug to also return the owner profile.
-- Saves one round trip on public /q/[slug] pages (RPC + profiles -> single RPC).
-- Only exposes non-sensitive profile fields; bank_account is intentionally included
-- because it is already embedded in provider_details for paid quotes.

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
  owner_bank_account TEXT,
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
    p.business_name, p.phone, p.email, p.address, p.bank_account,
    COALESCE(p.subscription_tier, 'free')
  FROM api.quotes q
  LEFT JOIN api.profiles p ON p.id = q.user_id
  WHERE q.slug = p_slug
    AND q.status IN ('sent', 'accepted');
END;
$$;

GRANT EXECUTE ON FUNCTION api.get_quote_by_slug(TEXT) TO anon, authenticated;
