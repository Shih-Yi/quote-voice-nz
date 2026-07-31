import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserServer } from "@/lib/supabase/auth-server";
import { rateLimit } from "@/lib/rateLimit";
import { stripe, STRIPE_PRICES, type StripePriceKey } from "@/lib/stripe";
import { getSubscriptionInfo } from "@/lib/supabase/subscription";

const VALID_PRICE_KEYS = new Set<StripePriceKey>([
  "pro_monthly",
  "pro_yearly",
  "team_monthly",
  "team_yearly",
]);

const TRIAL_PERIOD_DAYS = 14;

export async function POST(request: NextRequest) {
  // This route was the only mutating endpoint with no limiter of its own —
  // each call creates a Stripe session and costs a subscription lookup.
  const rateLimited = await rateLimit(request, { limit: 10, windowSeconds: 60 });
  if (rateLimited) return rateLimited;

  const user = await getCurrentUserServer();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { priceKey } = body as { priceKey?: string };

  if (!priceKey || !VALID_PRICE_KEYS.has(priceKey as StripePriceKey)) {
    return NextResponse.json(
      { error: "Invalid price selection" },
      { status: 400 }
    );
  }

  const priceId = STRIPE_PRICES[priceKey as StripePriceKey];
  if (!priceId) {
    return NextResponse.json(
      { error: "Price not configured — check STRIPE_PRICE_* environment variables" },
      { status: 503 }
    );
  }

  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    // Reuse existing Stripe customer if available
    const info = await getSubscriptionInfo(user.id);
    const existingCustomerId = info.stripeCustomerId;

    // One trial per account. Stripe grants trial_period_days on every
    // subscription it is passed with, so offering it unconditionally let a
    // user subscribe, cancel inside the trial, resubscribe and never pay.
    // Any prior Stripe relationship — customer id, subscription id, or a
    // recorded trial — means the free run has been used.
    const hasTrialled = Boolean(
      info.stripeCustomerId || info.stripeSubscriptionId || info.trialEndsAt
    );

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings/billing?success=1`,
      cancel_url: `${origin}/pricing?cancelled=1`,
      client_reference_id: user.id,
      customer_email: existingCustomerId ? undefined : user.email ?? undefined,
      customer: existingCustomerId ?? undefined,
      subscription_data: {
        ...(hasTrialled ? {} : { trial_period_days: TRIAL_PERIOD_DAYS }),
        metadata: { userId: user.id },
      },
      metadata: { userId: user.id },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
