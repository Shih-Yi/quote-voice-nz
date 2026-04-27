import Stripe from "stripe";

// Lazy singleton — initialised on first request, not at module load time.
// This prevents build-time failures when STRIPE_SECRET_KEY is not set.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  _stripe = new Stripe(key, {
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
  });

  return _stripe;
}

// Convenience proxy — callers can use `stripe.xxx` directly.
// The proxy ensures STRIPE_SECRET_KEY is only required at request time.
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Stripe Price IDs — set in environment variables
// Create these in your Stripe Dashboard and add to .env.local
export const STRIPE_PRICES = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
  pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? "",
  team_monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY ?? "",
  team_yearly: process.env.STRIPE_PRICE_TEAM_YEARLY ?? "",
} as const;

export type StripePriceKey = keyof typeof STRIPE_PRICES;
