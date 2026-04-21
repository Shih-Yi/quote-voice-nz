"use client";

import useSWR from "swr";
import { useAuth } from "@/hooks/useAuth";
import {
  TIER_LIMITS,
  type SubscriptionTier,
  type SubscriptionStatus,
  type TierLimits,
  type MonthlyUsage,
} from "@/lib/supabase/subscription";

interface SubscriptionState {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  limits: TierLimits;
  usage: MonthlyUsage;
  isLoading: boolean;
  canCreateQuote: boolean;
  canSendEmail: boolean;
  isPro: boolean;
  isTeam: boolean;
  isPaid: boolean;
  refresh: () => void;
}

interface SubscriptionPayload {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  usage: MonthlyUsage;
}

const DEFAULT_USAGE: MonthlyUsage = { quotesCreated: 0, emailsSent: 0 };

const DEFAULT_PAYLOAD: SubscriptionPayload = {
  tier: "free",
  status: "active",
  trialEndsAt: null,
  currentPeriodEnd: null,
  usage: DEFAULT_USAGE,
};

async function fetchSubscription(url: string): Promise<SubscriptionPayload> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch subscription");
  const data = await res.json();
  return {
    tier: data.tier ?? "free",
    status: data.status ?? "active",
    trialEndsAt: data.trialEndsAt ?? null,
    currentPeriodEnd: data.currentPeriodEnd ?? null,
    usage: data.usage ?? DEFAULT_USAGE,
  };
}

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();

  // Null key disables the request when signed out. SWR dedupes concurrent
  // requests with the same key across all call sites automatically.
  const { data, isLoading, mutate } = useSWR<SubscriptionPayload>(
    user ? "/api/subscription/tier" : null,
    fetchSubscription,
    {
      fallbackData: DEFAULT_PAYLOAD,
      revalidateOnFocus: false,
      dedupingInterval: 10_000,
      onError: () => {
        // Default to free on error — never block the user.
      },
    }
  );

  const payload = data ?? DEFAULT_PAYLOAD;
  const limits = TIER_LIMITS[payload.tier];

  return {
    tier: payload.tier,
    status: payload.status,
    trialEndsAt: payload.trialEndsAt,
    currentPeriodEnd: payload.currentPeriodEnd,
    limits,
    usage: payload.usage,
    isLoading: user ? isLoading : false,
    canCreateQuote: payload.usage.quotesCreated < limits.quotesPerMonth,
    canSendEmail: payload.usage.emailsSent < limits.emailsPerMonth,
    isPro: payload.tier === "pro",
    isTeam: payload.tier === "team",
    isPaid: payload.tier === "pro" || payload.tier === "team",
    refresh: () => {
      mutate();
    },
  };
}
