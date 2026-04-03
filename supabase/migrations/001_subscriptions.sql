-- Migration: Add subscription and usage tracking tables
-- Schema: api (matches the existing Supabase client schema setting)

-- 1. Subscriptions table
CREATE TABLE IF NOT EXISTS api.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'team')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'cancelled')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  billing_interval TEXT DEFAULT 'month' CHECK (billing_interval IN ('month', 'year')),
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON api.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON api.subscriptions(stripe_customer_id);

-- 2. Usage stats table (monthly counters, reset each month)
CREATE TABLE IF NOT EXISTS api.usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  billing_month TEXT NOT NULL,  -- format: 'YYYY-MM'
  quotes_created INT NOT NULL DEFAULT 0,
  emails_sent INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_usage_stats_user_month ON api.usage_stats(user_id, billing_month);

-- 3. Add subscription_tier to profiles for fast lookups (denormalised)
ALTER TABLE api.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'pro', 'team'));

-- 4. RLS Policies

-- subscriptions: users can only read their own row
ALTER TABLE api.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own"
  ON api.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "subscriptions_insert_own"
  ON api.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subscriptions_update_own"
  ON api.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- usage_stats: users can only read/write their own row
ALTER TABLE api.usage_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_stats_select_own"
  ON api.usage_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "usage_stats_insert_own"
  ON api.usage_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "usage_stats_update_own"
  ON api.usage_stats FOR UPDATE
  USING (auth.uid() = user_id);

-- 5. Function: sync subscription_tier to profiles when subscription changes
CREATE OR REPLACE FUNCTION api.sync_subscription_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = api, public
AS $$
BEGIN
  UPDATE api.profiles
  SET subscription_tier = NEW.tier
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_sync_subscription_tier
  AFTER INSERT OR UPDATE OF tier ON api.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION api.sync_subscription_tier();

-- 6. Function: get tier limits (used by API routes)
CREATE OR REPLACE FUNCTION api.get_tier_limits(p_tier TEXT)
RETURNS JSON
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN CASE p_tier
    WHEN 'free' THEN
      '{"quotesPerMonth": 5, "emailsPerMonth": 3, "templates": 3, "attachmentsPerQuote": 3, "versions": 2}'::JSON
    WHEN 'pro' THEN
      '{"quotesPerMonth": 99999, "emailsPerMonth": 50, "templates": 99999, "attachmentsPerQuote": 20, "versions": 99999}'::JSON
    WHEN 'team' THEN
      '{"quotesPerMonth": 99999, "emailsPerMonth": 200, "templates": 99999, "attachmentsPerQuote": 20, "versions": 99999}'::JSON
    ELSE
      '{"quotesPerMonth": 5, "emailsPerMonth": 3, "templates": 3, "attachmentsPerQuote": 3, "versions": 2}'::JSON
  END;
END;
$$;
