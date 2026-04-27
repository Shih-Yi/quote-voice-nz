import { createHash } from "crypto";
import { getServerSupabase } from "@/lib/supabase/server";

// Daily quota limits for the transcribe pipeline.
// GLOBAL guards total infra spend; ANON_DEVICE and ANON_IP gate unauthenticated
// abuse; authenticated users are governed by tier-based limits elsewhere.
export const LIMITS = {
  GLOBAL_DAILY_TRANSCRIBES: 200,
  ANON_DEVICE_DAILY: 3,
  ANON_IP_DAILY: 5,
} as const;

type QuotaScope = "global" | "device" | "ip" | "user";

export interface GuardResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// Seconds until next UTC midnight — day-bucket limits reset there.
function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0
    )
  );
  return Math.max(0, Math.ceil((tomorrow.getTime() - now.getTime()) / 1000));
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function consume(
  scope: QuotaScope,
  identifier: string,
  limit: number
): Promise<GuardResult> {
  const supabase = getServerSupabase();

  // Fail-open when Supabase isn't configured (local dev without env). Logged
  // so the misconfiguration is obvious rather than silently unlimited.
  if (!supabase) {
    console.warn("[costGuard] Supabase not configured — quota check skipped");
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }

  const { data, error } = await supabase.rpc(
    "increment_transcribe_quota_if_allowed",
    {
      p_scope: scope,
      p_identifier: identifier,
      p_date: todayUtc(),
      p_limit: limit,
    }
  );

  if (error) {
    console.error("[costGuard] RPC error:", error.message);
    // Fail-open on RPC errors — don't block legitimate users because of a
    // transient DB issue. The global cap and per-IP burst limit still apply.
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }

  const newCount = data as number;

  if (newCount === -1) {
    return { allowed: false, remaining: 0, retryAfter: secondsUntilUtcMidnight() };
  }

  return { allowed: true, remaining: Math.max(0, limit - newCount), retryAfter: 0 };
}

// Single key — shared across all requests. Protects against runaway Groq spend.
export async function checkGlobalTranscribeCap(): Promise<GuardResult> {
  return consume("global", "all", LIMITS.GLOBAL_DAILY_TRANSCRIBES);
}

// Per-device-token daily quota for anonymous users.
export async function checkAnonDeviceQuota(
  deviceToken: string
): Promise<GuardResult> {
  return consume(
    "device",
    hashIdentifier(deviceToken),
    LIMITS.ANON_DEVICE_DAILY
  );
}

// Per-IP daily quota for anonymous users. Prevents the "clear cookies and
// re-roll device token" loophole from the device quota alone.
export async function checkAnonIpQuota(ip: string): Promise<GuardResult> {
  return consume("ip", hashIdentifier(ip), LIMITS.ANON_IP_DAILY);
}

// Per-user daily quota for logged-in users. Increments the counter. Every
// tier has a hard cap — no "unlimited" short-circuit, by design, to prevent
// abuse via uncapped paths.
export async function consumeUserDailyQuota(
  userId: string,
  limit: number
): Promise<GuardResult> {
  return consume("user", userId, limit);
}

// Read-only variant of the user daily quota. Used by routes that should gate
// on the daily cap but must not increment (e.g. /api/extract is paired with
// /api/transcribe and would otherwise double-count one quote).
export async function peekUserDailyQuota(
  userId: string,
  limit: number
): Promise<GuardResult> {
  const supabase = getServerSupabase();
  if (!supabase) {
    console.warn("[costGuard] Supabase not configured — peek skipped");
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }

  const { data, error } = await supabase
    .from("transcribe_quota")
    .select("count")
    .eq("scope", "user")
    .eq("identifier", userId)
    .eq("usage_date", todayUtc())
    .maybeSingle();

  if (error) {
    console.error("[costGuard] peek error:", error.message);
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }

  const used = (data?.count as number | undefined) ?? 0;
  if (used >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: secondsUntilUtcMidnight(),
    };
  }
  return { allowed: true, remaining: limit - used, retryAfter: 0 };
}
