"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { TIER_LIMITS } from "@/lib/supabase/subscription";

type Interval = "month" | "year";

const PRICE_NZD = {
  pro: { month: 29, year: 290 },
  team: { month: 49, year: 490 },
};

const PRICE_KEYS = {
  pro: { month: "pro_monthly", year: "pro_yearly" },
  team: { month: "team_monthly", year: "team_yearly" },
} as const;

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg className="w-4 h-4 text-text-muted/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

interface Feature {
  label: string;
  free: string | boolean;
  pro: string | boolean;
  team: string | boolean;
}

const FEATURES: Feature[] = [
  // Core
  { label: "Voice-to-Quote", free: "5 / month", pro: "200 / month", team: "400 / month" },
  { label: "Quote editing & delete", free: true, pro: true, team: true },
  { label: "GST calculation (15%)", free: true, pro: true, team: true },
  { label: "Customer signature", free: true, pro: true, team: true },
  { label: "PWA install", free: true, pro: true, team: true },
  // Sharing
  { label: "Public quote link", free: "With watermark", pro: "No watermark", team: "No watermark" },
  { label: "Email quote sending", free: "3 / month", pro: "50 / month", team: "200 / month" },
  { label: "PDF export", free: "With watermark", pro: "No watermark", team: "No watermark" },
  // Management
  { label: "Quote versioning", free: "Max 2", pro: "Up to 10", team: "Up to 20" },
  { label: "Version diff view", free: false, pro: true, team: true },
  { label: "Item templates", free: "3 templates", pro: "50 templates", team: "100 templates + shared" },
  { label: "Image attachments", free: "3 / quote", pro: "20 / quote", team: "20 / quote" },
  { label: "Bulk operations", free: false, pro: true, team: true },
  { label: "CSV export", free: false, pro: true, team: true },
  // Analytics
  { label: "Revenue dashboard", free: "Current month only", pro: "Full history", team: "Full + team stats" },
  { label: "Audit log retention", free: "7 days", pro: "180 days", team: "365 days" },
  { label: "Admin panel", free: false, pro: true, team: true },
  // Team
  { label: "Team members", free: false, pro: false, team: "Up to 5" },
  { label: "Role-based access", free: false, pro: false, team: true },
  { label: "Shared template library", free: false, pro: false, team: true },
];

function FeatureValue({ value }: { value: string | boolean }) {
  if (value === true) return <CheckIcon />;
  if (value === false) return <CrossIcon />;
  return <span className="text-sm text-text">{value}</span>;
}

export default function PricingPage() {
  const [interval, setInterval] = useState<Interval>("month");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const { tier: currentTier, isLoading } = useSubscription();

  const handleCheckout = async (plan: "pro" | "team") => {
    if (!user) {
      router.push("/?auth=signup");
      return;
    }

    const priceKey = PRICE_KEYS[plan][interval];
    setLoadingPlan(plan);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceKey }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");

      window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoadingPlan(null);
    }
  };

  const yearSaving = (monthly: number, yearly: number) =>
    Math.round(((monthly * 12 - yearly) / (monthly * 12)) * 100);

  return (
    <div className="min-h-dvh bg-bg py-12 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-text mb-3">Simple, honest pricing</h1>
          <p className="text-text-muted text-lg">For NZ tradies who want professional quotes without the admin hassle.</p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg border border-border bg-bg-white p-1 gap-1">
            <button
              onClick={() => setInterval("month")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                interval === "month"
                  ? "bg-primary text-white"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("year")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                interval === "year"
                  ? "bg-primary text-white"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Yearly
              <span className="ml-1.5 text-xs bg-secondary/20 text-secondary px-1.5 py-0.5 rounded-full font-semibold">
                Save {yearSaving(PRICE_NZD.pro.month, PRICE_NZD.pro.year)}%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">

          {/* Free */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-1">Starter</div>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold text-text">$0</span>
                <span className="text-text-muted mb-1">NZD / forever</span>
              </div>
              <p className="text-sm text-text-muted mt-1">Get started with voice quoting</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm">5 voice quotes / month</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm">3 email sends / month</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm">3 item templates</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm">Offline-first (IndexedDB)</span></div>
                <div className="flex items-center gap-2"><CrossIcon /><span className="text-sm text-text-muted">QuoteTalk watermark on quotes</span></div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                disabled={!isLoading && currentTier === "free"}
                onClick={() => router.push("/dashboard")}
              >
                {currentTier === "free" ? "Your current plan" : "Downgrade"}
              </Button>
            </CardContent>
          </Card>

          {/* Pro */}
          <Card className="border-primary shadow-lg shadow-primary/10 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">Most popular</span>
            </div>
            <CardHeader className="pb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">Pro</div>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold text-text">${PRICE_NZD.pro[interval]}</span>
                <span className="text-text-muted mb-1">NZD / {interval}</span>
              </div>
              {interval === "year" && (
                <p className="text-xs text-secondary font-medium">
                  ${(PRICE_NZD.pro.year / 12).toFixed(0)}/mo — 2 months free
                </p>
              )}
              <p className="text-sm text-text-muted mt-1">Professional quoting for full-time tradies</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm font-medium">200 voice quotes / month</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm">50 email sends / month</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm">50 item templates</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm">No watermark</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm">Full revenue dashboard</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm">CSV export & bulk ops</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm font-medium text-secondary">14-day free trial</span></div>
              </div>
              <Button
                className="w-full bg-primary hover:bg-primary-dark"
                disabled={loadingPlan === "pro" || (!isLoading && currentTier === "pro")}
                onClick={() => handleCheckout("pro")}
              >
                {loadingPlan === "pro" ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : currentTier === "pro" ? (
                  "Your current plan"
                ) : (
                  "Start free trial"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Team */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-1">Team</div>
              <div className="flex items-end gap-1">
                <span className="text-3xl font-bold text-text">${PRICE_NZD.team[interval]}</span>
                <span className="text-text-muted mb-1">NZD / {interval}</span>
              </div>
              {interval === "year" && (
                <p className="text-xs text-secondary font-medium">
                  ${(PRICE_NZD.team.year / 12).toFixed(0)}/mo — 2 months free
                </p>
              )}
              <p className="text-sm text-text-muted mt-1">Collaboration for crews of 2–5</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm font-medium">400 voice quotes / month</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm">Everything in Pro</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm">200 email sends / month</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm">Up to 5 team members</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm">Role-based access control</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm">Shared template library</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm">Team revenue stats</span></div>
                <div className="flex items-center gap-2"><CheckIcon /><span className="text-sm font-medium text-secondary">14-day free trial</span></div>
              </div>
              <Button
                variant="outline"
                className="w-full border-text/20"
                disabled={loadingPlan === "team" || (!isLoading && currentTier === "team")}
                onClick={() => handleCheckout("team")}
              >
                {loadingPlan === "team" ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : currentTier === "team" ? (
                  "Your current plan"
                ) : (
                  "Start free trial"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Full feature comparison table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 pr-4 text-text-muted font-medium">Feature</th>
                <th className="text-center py-3 px-3 text-text font-semibold">Free</th>
                <th className="text-center py-3 px-3 text-primary font-semibold">Pro</th>
                <th className="text-center py-3 px-3 text-text font-semibold">Team</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => (
                <tr key={f.label} className={i % 2 === 0 ? "bg-bg-white" : ""}>
                  <td className="py-2.5 pr-4 text-text-muted pl-2">{f.label}</td>
                  <td className="py-2.5 px-3 text-center"><div className="flex justify-center"><FeatureValue value={f.free} /></div></td>
                  <td className="py-2.5 px-3 text-center"><div className="flex justify-center"><FeatureValue value={f.pro} /></div></td>
                  <td className="py-2.5 px-3 text-center"><div className="flex justify-center"><FeatureValue value={f.team} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Limits reference */}
        <div className="mt-8 p-4 bg-bg-white rounded-lg border border-border text-xs text-text-muted">
          <p className="font-medium text-text mb-1">Plan limits at a glance</p>
          <p>Free: {TIER_LIMITS.free.quotesPerMonth} quotes · {TIER_LIMITS.free.emailsPerMonth} emails · {TIER_LIMITS.free.templates} templates · {TIER_LIMITS.free.attachmentsPerQuote} attachments/quote</p>
          <p className="mt-0.5">Pro: {TIER_LIMITS.pro.quotesPerMonth} quotes/mo ({TIER_LIMITS.pro.quotesPerDay}/day) · {TIER_LIMITS.pro.emailsPerMonth} emails/mo · {TIER_LIMITS.pro.templates} templates · {TIER_LIMITS.pro.attachmentsPerQuote} attachments/quote · {TIER_LIMITS.pro.versions} versions/quote</p>
          <p className="mt-0.5">Team: {TIER_LIMITS.team.quotesPerMonth} quotes/mo ({TIER_LIMITS.team.quotesPerDay}/day) · {TIER_LIMITS.team.emailsPerMonth} emails/mo · {TIER_LIMITS.team.templates} templates · {TIER_LIMITS.team.attachmentsPerQuote} attachments/quote · {TIER_LIMITS.team.versions} versions/quote</p>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-text-muted mt-6">
          All prices in NZD incl. GST. Cancel anytime. Payments processed securely by Stripe.
        </p>
      </div>
    </div>
  );
}
