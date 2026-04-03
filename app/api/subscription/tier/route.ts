import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/auth";
import {
  getUserTier,
  getMonthlyUsage,
  getSubscriptionInfo,
  TIER_LIMITS,
} from "@/lib/supabase/subscription";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({
      tier: "free",
      status: "active",
      trialEndsAt: null,
      currentPeriodEnd: null,
      usage: { quotesCreated: 0, emailsSent: 0 },
      limits: TIER_LIMITS.free,
    });
  }

  const [tier, usage, info] = await Promise.all([
    getUserTier(user.id),
    getMonthlyUsage(user.id),
    getSubscriptionInfo(user.id),
  ]);

  return NextResponse.json({
    tier,
    status: info.status,
    trialEndsAt: info.trialEndsAt,
    currentPeriodEnd: info.currentPeriodEnd,
    usage,
    limits: TIER_LIMITS[tier],
  });
}
