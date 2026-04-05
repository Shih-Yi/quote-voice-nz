import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserServer } from "@/lib/supabase/auth-server";
import { stripe, STRIPE_PRICES, type StripePriceKey } from "@/lib/stripe";
import { getSubscriptionInfo } from "@/lib/supabase/subscription";

const VALID_PRICE_KEYS = new Set<StripePriceKey>([
  "pro_monthly",
  "pro_yearly",
  "team_monthly",
  "team_yearly",
]);

export async function POST(request: NextRequest) {
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

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings/billing?success=1`,
      cancel_url: `${origin}/pricing?cancelled=1`,
      client_reference_id: user.id,
      customer_email: existingCustomerId ? undefined : user.email ?? undefined,
      customer: existingCustomerId ?? undefined,
      subscription_data: {
        trial_period_days: 14,
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
