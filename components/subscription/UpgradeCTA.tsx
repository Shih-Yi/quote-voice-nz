"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { SubscriptionTier } from "@/lib/supabase/subscription";

interface UpgradeCTAProps {
  /** What triggered the upgrade prompt */
  reason: "quotes" | "emails" | "feature";
  /** How many were used / limit */
  used?: number;
  limit?: number;
  tier?: SubscriptionTier;
  onUpgrade?: () => void;
  onDismiss?: () => void;
}

const REASON_COPY: Record<
  UpgradeCTAProps["reason"],
  { title: string; body: string }
> = {
  quotes: {
    title: "You've used all your voice quotes this month",
    body: "Upgrade to Pro for unlimited voice quotes, no watermarks, and heaps more.",
  },
  emails: {
    title: "You've hit your monthly email limit",
    body: "Upgrade to Pro to send up to 50 quote emails per month.",
  },
  feature: {
    title: "This feature is for Pro users",
    body: "Upgrade to Pro to unlock this and many other features.",
  },
};

export function UpgradeCTA({
  reason,
  used,
  limit,
  onUpgrade,
  onDismiss,
}: UpgradeCTAProps) {
  const copy = REASON_COPY[reason];
  const hasUsageInfo = used !== undefined && limit !== undefined;

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      window.location.href = "/pricing";
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-5">
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="font-semibold text-text text-base">{copy.title}</h3>
            {hasUsageInfo && (
              <p className="text-sm text-text-muted mt-0.5">
                {used} / {limit} used this month
              </p>
            )}
          </div>
          <p className="text-sm text-text-muted">{copy.body}</p>
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleUpgrade}
              className="flex-1 bg-primary hover:bg-primary-dark"
            >
              Upgrade to Pro — $29/mo
            </Button>
            {onDismiss && (
              <Button variant="ghost" onClick={onDismiss} className="text-text-muted">
                Maybe later
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Inline modal overlay variant */
export function UpgradeCTAModal({
  open,
  reason,
  used,
  limit,
  tier,
  onUpgrade,
  onClose,
}: UpgradeCTAProps & { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm">
        <UpgradeCTA
          reason={reason}
          used={used}
          limit={limit}
          tier={tier}
          onUpgrade={onUpgrade}
          onDismiss={onClose}
        />
      </div>
    </div>
  );
}
