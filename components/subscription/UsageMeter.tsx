"use client";

import { useSubscription } from "@/hooks/useSubscription";

interface UsageMeterProps {
  /** Which meter to show */
  type: "quotes" | "emails";
  /** Show compact inline version (no card wrapper) */
  compact?: boolean;
  className?: string;
}

export function UsageMeter({ type, compact = false, className = "" }: UsageMeterProps) {
  const { usage, limits, tier, isLoading } = useSubscription();

  if (isLoading) return null;

  // Pro/Team: unlimited — don't show meter
  if (tier !== "free") return null;

  const used = type === "quotes" ? usage.quotesCreated : usage.emailsSent;
  const limit = type === "quotes" ? limits.quotesPerMonth : limits.emailsPerMonth;
  const label = type === "quotes" ? "voice quotes" : "emails";

  const pct = Math.min((used / limit) * 100, 100);
  const isNearLimit = pct >= 60;
  const isAtLimit = used >= limit;

  const barColor = isAtLimit
    ? "bg-red-500"
    : isNearLimit
    ? "bg-amber-500"
    : "bg-primary";

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-text-muted ${className}`}>
        <span
          className={`inline-block w-16 h-1.5 rounded-full bg-border overflow-hidden`}
        >
          <span
            className={`block h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className={isAtLimit ? "text-red-500 font-medium" : ""}>
          {used}/{limit} {label}
        </span>
      </span>
    );
  }

  return (
    <div className={`rounded-lg border border-border bg-bg-white p-3 ${className}`}>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-medium text-text capitalize">
          {label} this month
        </span>
        <span
          className={`text-sm font-semibold ${
            isAtLimit ? "text-red-500" : isNearLimit ? "text-amber-600" : "text-text"
          }`}
        >
          {used} / {limit}
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isAtLimit && (
        <p className="text-xs text-red-500 mt-1.5 font-medium">
          Limit reached — resets next month
        </p>
      )}
      {isNearLimit && !isAtLimit && (
        <p className="text-xs text-amber-600 mt-1.5">
          {limit - used} remaining this month
        </p>
      )}
    </div>
  );
}
