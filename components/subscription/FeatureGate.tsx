"use client";

import { type ReactNode } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import type { SubscriptionTier } from "@/lib/supabase/subscription";

interface FeatureGateProps {
  /** Minimum tier required to access the feature */
  require: SubscriptionTier;
  /** Content shown when user has access */
  children: ReactNode;
  /** Custom fallback (overrides default lock UI) */
  fallback?: ReactNode;
  /** Short label for the locked feature (e.g. "CSV export") */
  featureLabel?: string;
}

const TIER_ORDER: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  team: 2,
};

function hasAccess(userTier: SubscriptionTier, required: SubscriptionTier): boolean {
  return TIER_ORDER[userTier] >= TIER_ORDER[required];
}

const UPGRADE_LABEL: Record<SubscriptionTier, string> = {
  free: "Free",
  pro: "Pro",
  team: "Team",
};

export function FeatureGate({
  require,
  children,
  fallback,
  featureLabel,
}: FeatureGateProps) {
  const { tier, isLoading } = useSubscription();

  if (isLoading) return null;

  if (hasAccess(tier, require)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Default locked state
  return (
    <div className="relative inline-flex">
      {/* Dimmed child preview */}
      <div className="pointer-events-none select-none opacity-40 blur-[1px]">
        {children}
      </div>
      {/* Lock badge */}
      <div className="absolute inset-0 flex items-center justify-center">
        <a
          href="/pricing"
          className="flex items-center gap-1.5 rounded-full bg-text/90 px-3 py-1 text-xs font-semibold text-white shadow-md hover:bg-text transition-colors"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          {featureLabel
            ? `${featureLabel} — ${UPGRADE_LABEL[require]}`
            : `${UPGRADE_LABEL[require]} feature`}
        </a>
      </div>
    </div>
  );
}
