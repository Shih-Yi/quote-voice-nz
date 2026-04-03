import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { upsertSubscription } from "@/lib/supabase/subscription";
import type { SubscriptionTier, SubscriptionStatus } from "@/lib/supabase/subscription";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

// Map Stripe status to our status
function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const map: Partial<Record<Stripe.Subscription.Status, SubscriptionStatus>> = {
    active: "active",
    trialing: "trialing",
    past_due: "past_due",
    canceled: "cancelled",
    unpaid: "past_due",
  };
  return map[status] ?? "cancelled";
}

// Derive tier from the Stripe price ID
function tierFromPriceId(priceId: string): SubscriptionTier {
  const proMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY ?? "";
  const proYearly = process.env.STRIPE_PRICE_PRO_YEARLY ?? "";
  const teamMonthly = process.env.STRIPE_PRICE_TEAM_MONTHLY ?? "";
  const teamYearly = process.env.STRIPE_PRICE_TEAM_YEARLY ?? "";

  if (priceId === proMonthly || priceId === proYearly) return "pro";
  if (priceId === teamMonthly || priceId === teamYearly) return "team";
  return "free";
}

// Type helper for Stripe subscription fields that vary by API version
type SubscriptionWithBilling = Stripe.Subscription & {
  current_period_end?: number;
};

async function handleSubscriptionEvent(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId) {
    console.error("Stripe webhook: subscription missing userId metadata", sub.id);
    return;
  }

  const priceId = sub.items.data[0]?.price.id ?? "";
  const tier = tierFromPriceId(priceId);
  const status = mapStatus(sub.status);
  const billingInterval =
    sub.items.data[0]?.price.recurring?.interval === "year" ? "year" : "month";
  const periodEnd = (sub as SubscriptionWithBilling).current_period_end;

  await upsertSubscription({
    userId,
    tier,
    status,
    stripeCustomerId: sub.customer as string,
    stripeSubscriptionId: sub.id,
    billingInterval,
    trialEndsAt: sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : null,
    currentPeriodEnd: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
  });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId) return;

  const periodEnd = (sub as SubscriptionWithBilling).current_period_end;

  // Revert to free — keep all data
  await upsertSubscription({
    userId,
    tier: "free",
    status: "cancelled",
    stripeCustomerId: sub.customer as string,
    stripeSubscriptionId: sub.id,
    currentPeriodEnd: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
  });
}

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Subscription is created; the subscription.updated event will handle tier sync
        if (session.mode !== "subscription") break;
        console.log("Checkout completed for user:", session.client_reference_id);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        // Unhandled event — ignore
        break;
    }
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
