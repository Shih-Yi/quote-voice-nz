-- Migration: Atomic usage increment to prevent race condition
-- Replaces the non-atomic read-check-update pattern in checkAndIncrementUsage()

-- Function: atomically increment a usage counter if within limit
-- Returns the new count, or -1 if over limit
CREATE OR REPLACE FUNCTION api.increment_usage_if_allowed(
  p_user_id UUID,
  p_billing_month TEXT,
  p_field TEXT,       -- 'quotes_created' or 'emails_sent'
  p_limit INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_new_value INTEGER;
BEGIN
  -- Ensure a row exists for this user+month (no-op if already present)
  INSERT INTO api.usage_stats (user_id, billing_month)
  VALUES (p_user_id, p_billing_month)
  ON CONFLICT (user_id, billing_month) DO NOTHING;

  -- Atomic check-and-increment in a single UPDATE
  -- The WHERE condition ensures we only increment if under the limit
  IF p_field = 'quotes_created' THEN
    UPDATE api.usage_stats
    SET quotes_created = quotes_created + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND billing_month = p_billing_month
      AND quotes_created < p_limit
    RETURNING quotes_created INTO v_new_value;
  ELSIF p_field = 'emails_sent' THEN
    UPDATE api.usage_stats
    SET emails_sent = emails_sent + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND billing_month = p_billing_month
      AND emails_sent < p_limit
    RETURNING emails_sent INTO v_new_value;
  ELSE
    RAISE EXCEPTION 'Unknown usage field: %', p_field;
  END IF;

  -- If UPDATE matched 0 rows, the user is at or over the limit
  IF v_new_value IS NULL THEN
    RETURN -1;
  END IF;

  RETURN v_new_value;
END;
$$;

-- Grant execute to service_role (used by API routes via getServerSupabase)
GRANT EXECUTE ON FUNCTION api.increment_usage_if_allowed(UUID, TEXT, TEXT, INTEGER)
  TO service_role;
