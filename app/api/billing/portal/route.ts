import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserServer } from "@/lib/supabase/auth-server";
import { stripe } from "@/lib/stripe";
import { getSubscriptionInfo } from "@/lib/supabase/subscription";

export async function POST(request: NextRequest) {
  const user = await getCurrentUserServer();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const info = await getSubscriptionInfo(user.id);
  const stripeCustomerId = info.stripeCustomerId;

  if (!stripeCustomerId) {
    return NextResponse.json(
      { error: "No active subscription found" },
      { status: 404 }
    );
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe portal error:", err);
    return NextResponse.json(
      { error: "Failed to create billing portal session" },
      { status: 500 }
    );
  }
}
