-- Make the Stripe webhook safe against redelivery and out-of-order events.
--
-- PROBLEM
-- The handler verified the signature correctly but then applied every event
-- unconditionally. Two consequences:
--
-- 1. No deduplication. Stripe retries on any non-2xx and can deliver the same
--    event more than once even on success. upsertSubscription is idempotent
--    for identical input, so this was mostly benign — but it made every
--    delivery re-run the write, and it hid genuine double-processing.
--
-- 2. No ordering. Stripe explicitly does NOT guarantee delivery order. If
--    `customer.subscription.deleted` was processed and an older
--    `customer.subscription.updated` (status=active) arrived afterwards, the
--    cancelled account was silently restored to an active paid tier.
--
-- FIX
-- 1. api.stripe_events records every event id we have handled, so a repeat
--    delivery is acknowledged and skipped.
-- 2. api.subscriptions gains last_stripe_event_at, the `created` timestamp of
--    the event that produced the current state. The handler ignores any event
--    older than that.
-- ============================================

-- ============================================
-- 1. Processed-event ledger
-- ============================================
CREATE TABLE IF NOT EXISTS api.stripe_events (
  id TEXT PRIMARY KEY,                -- Stripe event id, e.g. evt_1A2b3C
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only the webhook (service_role) ever touches this table.
ALTER TABLE api.stripe_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_stripe_events_all" ON api.stripe_events;
CREATE POLICY "service_role_stripe_events_all"
  ON api.stripe_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON api.stripe_events FROM anon, authenticated;

-- Keeps the ledger from growing without bound. Stripe retries for at most a
-- few days, so a month of history is far more than needed.
CREATE INDEX IF NOT EXISTS idx_stripe_events_created_at
  ON api.stripe_events(created_at);

CREATE OR REPLACE FUNCTION api.cleanup_stripe_events(p_older_than_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM api.stripe_events
  WHERE created_at < NOW() - (p_older_than_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION api.cleanup_stripe_events(INT) FROM public, anon, authenticated;

-- ============================================
-- 2. Ordering guard on the subscription row
-- ============================================
ALTER TABLE api.subscriptions
  ADD COLUMN IF NOT EXISTS last_stripe_event_at TIMESTAMPTZ;

COMMENT ON COLUMN api.subscriptions.last_stripe_event_at IS
  'Stripe `created` timestamp of the event that produced this row. The webhook '
  'discards any event older than this, because Stripe does not guarantee '
  'delivery order and a late cancel/activate pair would otherwise flip the '
  'tier back.';

-- ============================================
-- 3. Schedule the cleanups that were written but never scheduled
-- ============================================
-- cleanup_anon_orphan_quotes (migration 013) has been sitting unscheduled;
-- schedule it here alongside the new one. pg_cron may not be available on all
-- plans, so this is best-effort and logs rather than failing the migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('ksq-cleanup-anon-quotes')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ksq-cleanup-anon-quotes');
    PERFORM cron.schedule(
      'ksq-cleanup-anon-quotes',
      '17 3 * * *',
      $cron$SELECT api.cleanup_anon_orphan_quotes(false, 500)$cron$
    );

    PERFORM cron.unschedule('ksq-cleanup-stripe-events')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ksq-cleanup-stripe-events');
    PERFORM cron.schedule(
      'ksq-cleanup-stripe-events',
      '42 3 * * 0',
      $cron$SELECT api.cleanup_stripe_events(30)$cron$
    );

    RAISE NOTICE 'pg_cron jobs scheduled';
  ELSE
    RAISE NOTICE 'pg_cron not installed — schedule cleanup_anon_orphan_quotes and cleanup_stripe_events externally';
  END IF;
END;
$$;
