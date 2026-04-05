import { getServerSupabase } from "./server";

export type SubscriptionTier = "free" | "pro" | "team";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "cancelled";

export interface TierLimits {
  quotesPerMonth: number;
  emailsPerMonth: number;
  templates: number;
  attachmentsPerQuote: number;
  versions: number;
}

export interface MonthlyUsage {
  quotesCreated: number;
  emailsSent: number;
}

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  billingInterval: "month" | "year" | null;
}

// Tier limits — single source of truth (mirrors SQL function get_tier_limits)
export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    quotesPerMonth: 5,
    emailsPerMonth: 3,
    templates: 3,
    attachmentsPerQuote: 3,
    versions: 2,
  },
  pro: {
    quotesPerMonth: 99999,
    emailsPerMonth: 50,
    templates: 99999,
    attachmentsPerQuote: 20,
    versions: 99999,
  },
  team: {
    quotesPerMonth: 99999,
    emailsPerMonth: 200,
    templates: 99999,
    attachmentsPerQuote: 20,
    versions: 99999,
  },
};

function currentBillingMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// Get a user's current subscription info.
// Falls back to free/active if no record found (new users are always Free).
export async function getSubscriptionInfo(userId: string): Promise<SubscriptionInfo> {
  const supabase = getServerSupabase();
  if (!supabase) {
    return { tier: "free", status: "active", trialEndsAt: null, currentPeriodEnd: null, stripeCustomerId: null, stripeSubscriptionId: null, billingInterval: null };
  }

  const { data } = await supabase
    .from("subscriptions")
    .select("tier, status, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id, billing_interval")
    .eq("user_id", userId)
    .single();

  if (!data) {
    return { tier: "free", status: "active", trialEndsAt: null, currentPeriodEnd: null, stripeCustomerId: null, stripeSubscriptionId: null, billingInterval: null };
  }

  return {
    tier: data.tier as SubscriptionTier,
    status: data.status as SubscriptionStatus,
    trialEndsAt: data.trial_ends_at,
    currentPeriodEnd: data.current_period_end,
    stripeCustomerId: data.stripe_customer_id ?? null,
    stripeSubscriptionId: data.stripe_subscription_id ?? null,
    billingInterval: (data.billing_interval as "month" | "year") ?? null,
  };
}

// Fast tier lookup using denormalised column on profiles
export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const supabase = getServerSupabase();
  if (!supabase) return "free";

  const { data } = await supabase
    .from("profiles")
    .select("subscription_tier")
    .eq("id", userId)
    .single();

  return (data?.subscription_tier as SubscriptionTier) ?? "free";
}

// Get current month's usage for a user
export async function getMonthlyUsage(userId: string): Promise<MonthlyUsage> {
  const supabase = getServerSupabase();
  if (!supabase) return { quotesCreated: 0, emailsSent: 0 };

  const { data } = await supabase
    .from("usage_stats")
    .select("quotes_created, emails_sent")
    .eq("user_id", userId)
    .eq("billing_month", currentBillingMonth())
    .single();

  return {
    quotesCreated: data?.quotes_created ?? 0,
    emailsSent: data?.emails_sent ?? 0,
  };
}

type UsageField = "quotes_created" | "emails_sent";

// Check if a user can perform an action, then increment the counter.
// Returns { allowed: true } or { allowed: false, limit, used }.
export async function checkAndIncrementUsage(
  userId: string,
  field: UsageField
): Promise<{ allowed: boolean; limit: number; used: number }> {
  const supabase = getServerSupabase();

  const tier = await getUserTier(userId);
  const limits = TIER_LIMITS[tier];
  const limit = field === "quotes_created" ? limits.quotesPerMonth : limits.emailsPerMonth;

  // Unlimited tiers — skip DB check
  if (limit >= 99999) {
    return { allowed: true, limit, used: 0 };
  }

  if (!supabase) {
    return { allowed: true, limit, used: 0 };
  }

  const month = currentBillingMonth();

  // Upsert row for current month, then check
  const { data: upserted } = await supabase
    .from("usage_stats")
    .upsert(
      { user_id: userId, billing_month: month, [field]: 0 },
      { onConflict: "user_id,billing_month", ignoreDuplicates: true }
    )
    .select(field)
    .single();

  // Read current value
  const { data: row } = await supabase
    .from("usage_stats")
    .select(field)
    .eq("user_id", userId)
    .eq("billing_month", month)
    .single();

  const used: number = (row as Record<string, number> | null)?.[field] ?? 0;

  if (used >= limit) {
    return { allowed: false, limit, used };
  }

  // Increment
  await supabase
    .from("usage_stats")
    .update({ [field]: used + 1, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("billing_month", month);

  void upserted; // suppress unused warning
  return { allowed: true, limit, used: used + 1 };
}

// Create or update a subscription record (called from Stripe webhook)
export async function upsertSubscription(params: {
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  billingInterval?: "month" | "year";
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
}): Promise<{ error: string | null }> {
  const supabase = getServerSupabase();
  if (!supabase) return { error: "Supabase not configured" };

  const { error } = await supabase.from("subscriptions").upsert({
    user_id: params.userId,
    tier: params.tier,
    status: params.status,
    stripe_customer_id: params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubscriptionId,
    billing_interval: params.billingInterval ?? "month",
    trial_ends_at: params.trialEndsAt ?? null,
    current_period_end: params.currentPeriodEnd ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (error) return { error: error.message };
  return { error: null };
}
