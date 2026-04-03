"use client";

import { useState, useEffect, useCallback } from "react";
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
  // Helpers
  canCreateQuote: boolean;
  canSendEmail: boolean;
  isPro: boolean;
  isTeam: boolean;
  isPaid: boolean;
  refresh: () => void;
}

const DEFAULT_USAGE: MonthlyUsage = { quotesCreated: 0, emailsSent: 0 };

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [status, setStatus] = useState<SubscriptionStatus>("active");
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [usage, setUsage] = useState<MonthlyUsage>(DEFAULT_USAGE);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setTier("free");
      setStatus("active");
      setTrialEndsAt(null);
      setCurrentPeriodEnd(null);
      setUsage(DEFAULT_USAGE);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/subscription/tier");
      if (!res.ok) throw new Error("Failed to fetch subscription");
      const data = await res.json();
      setTier(data.tier ?? "free");
      setStatus(data.status ?? "active");
      setTrialEndsAt(data.trialEndsAt ?? null);
      setCurrentPeriodEnd(data.currentPeriodEnd ?? null);
      setUsage(data.usage ?? DEFAULT_USAGE);
    } catch {
      // Default to free on error — never block the user
      setTier("free");
      setStatus("active");
      setTrialEndsAt(null);
      setCurrentPeriodEnd(null);
      setUsage(DEFAULT_USAGE);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const limits = TIER_LIMITS[tier];

  return {
    tier,
    status,
    trialEndsAt,
    currentPeriodEnd,
    limits,
    usage,
    isLoading,
    canCreateQuote: usage.quotesCreated < limits.quotesPerMonth,
    canSendEmail: usage.emailsSent < limits.emailsPerMonth,
    isPro: tier === "pro",
    isTeam: tier === "team",
    isPaid: tier === "pro" || tier === "team",
    refresh: fetchSubscription,
  };
}
