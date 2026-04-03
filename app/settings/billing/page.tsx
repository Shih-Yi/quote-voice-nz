"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { TIER_LIMITS } from "@/lib/supabase/subscription";
import { Header } from "@/components/layout/Header";
import { ArrowLeft, Loader2, ExternalLink, CheckCircle2, AlertCircle, Clock } from "lucide-react";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    active: {
      label: "Active",
      className: "bg-green-100 text-green-800",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    trialing: {
      label: "Free Trial",
      className: "bg-blue-100 text-blue-800",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    past_due: {
      label: "Past Due",
      className: "bg-amber-100 text-amber-800",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-gray-100 text-gray-600",
      icon: null,
    },
  };

  const config = map[status] ?? { label: status, className: "bg-gray-100 text-gray-600", icon: null };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

const TIER_LABELS: Record<string, string> = {
  free: "Starter (Free)",
  pro: "Pro",
  team: "Team",
};

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { tier, status, trialEndsAt, currentPeriodEnd, isLoading } = useSubscription();
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push("/");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (searchParams.get("success") === "1") {
      setShowSuccess(true);
      // Remove query param from URL without full reload
      window.history.replaceState({}, "", "/settings/billing");
    }
  }, [searchParams]);

  const handleOpenPortal = async () => {
    setIsPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Portal error");
      window.location.href = data.url;
    } catch (err) {
      console.error("Billing portal error:", err);
    } finally {
      setIsPortalLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const limits = TIER_LIMITS[tier];
  const isPaid = tier !== "free";
  const isTrialing = status === "trialing";

  return (
    <div className="min-h-screen bg-bg flex flex-col font-sans">
      <Header />

      <main className="flex-1 container max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <Link
            href="/settings"
            className="inline-flex items-center text-sm text-text-muted hover:text-primary mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Settings
          </Link>
          <h1 className="text-3xl font-bold text-text mb-2">Billing & Plan</h1>
          <p className="text-text-muted">Manage your subscription and billing details.</p>
        </div>

        {/* Success banner */}
        {showSuccess && (
          <div className="mb-6 flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800">Subscription activated!</p>
              <p className="text-sm text-green-700 mt-0.5">
                {isTrialing
                  ? "Your 14-day free trial has started. You won't be charged until your trial ends."
                  : "Your plan has been upgraded. All features are now unlocked."}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Current Plan Card */}
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Your active ChurQuote subscription.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-text">{TIER_LABELS[tier] ?? tier}</p>
                  {isPaid && (
                    <p className="text-sm text-text-muted mt-0.5">
                      {status === "trialing" && trialEndsAt
                        ? `Trial ends ${formatDate(trialEndsAt)}`
                        : currentPeriodEnd
                        ? `Renews ${formatDate(currentPeriodEnd)}`
                        : null}
                    </p>
                  )}
                </div>
                <StatusBadge status={status} />
              </div>

              {/* Limit summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
                <div className="text-center">
                  <p className="text-lg font-bold text-text">
                    {limits.quotesPerMonth >= 99999 ? "∞" : limits.quotesPerMonth}
                  </p>
                  <p className="text-xs text-text-muted">Quotes/mo</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-text">{limits.emailsPerMonth}</p>
                  <p className="text-xs text-text-muted">Emails/mo</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-text">
                    {limits.templates >= 99999 ? "∞" : limits.templates}
                  </p>
                  <p className="text-xs text-text-muted">Templates</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-text">{limits.attachmentsPerQuote}</p>
                  <p className="text-xs text-text-muted">Attachments</p>
                </div>
              </div>

              {/* Past due warning */}
              {status === "past_due" && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Your last payment failed. Please update your payment method to avoid service interruption.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manage Subscription (paid users) */}
          {isPaid && (
            <Card>
              <CardHeader>
                <CardTitle>Manage Subscription</CardTitle>
                <CardDescription>
                  Update payment method, change plan, or cancel — handled securely via Stripe.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleOpenPortal}
                  disabled={isPortalLoading}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  {isPortalLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Opening portal…
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Billing Portal
                    </>
                  )}
                </Button>
                <p className="text-xs text-text-muted mt-3">
                  You&apos;ll be redirected to Stripe to manage your subscription. Changes take effect immediately.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Upgrade CTA (free users) */}
          {!isPaid && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle>Upgrade to Pro</CardTitle>
                <CardDescription>
                  Unlock unlimited quotes, no watermark, CSV export, and more.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="text-sm text-text space-y-1.5">
                  {[
                    "Unlimited voice quotes (currently 5/mo)",
                    "No ChurQuote watermark on quotes & PDFs",
                    "50 email sends per month",
                    "Unlimited item templates",
                    "Full revenue dashboard & CSV export",
                    "14-day free trial — no credit card commitment",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/pricing">
                  <Button className="w-full sm:w-auto bg-primary hover:bg-primary-dark mt-2">
                    View Plans & Pricing →
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Billing info note */}
          <p className="text-xs text-text-muted text-center">
            All prices in NZD incl. GST. Payments processed securely by Stripe.{" "}
            <a
              href="mailto:support@churquote.co.nz"
              className="underline hover:text-primary"
            >
              Contact support
            </a>{" "}
            for billing questions.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  );
}
