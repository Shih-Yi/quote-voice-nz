import { createHash } from "crypto";
import { Redis } from "@upstash/redis";
import { getServerSupabase } from "@/lib/supabase/server";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// Daily quota limits.
//
// The global cap guards total infra spend. It is split into two pools so that
// unauthenticated traffic cannot starve paying customers: previously a single
// 200/day counter was shared, and 40 anonymous devices could exhaust it and
// leave every Pro user staring at "Service is at capacity for today".
//
// ANON_* gate unauthenticated abuse; authenticated users are additionally
// governed by tier limits in lib/supabase/subscription.
//
// All values are env-overridable — a hardcoded ceiling becomes a production
// incident the moment the product grows past it.
export const LIMITS = {
  GLOBAL_DAILY_TRANSCRIBES_FREE: envInt("KSQ_GLOBAL_DAILY_TRANSCRIBES_FREE", 200),
  GLOBAL_DAILY_TRANSCRIBES_PAID: envInt("KSQ_GLOBAL_DAILY_TRANSCRIBES_PAID", 2000),
  ANON_DEVICE_DAILY: envInt("KSQ_ANON_DEVICE_DAILY", 3),
  ANON_IP_DAILY: envInt("KSQ_ANON_IP_DAILY", 5),
  // Typed quotes cost no Groq spend, so these are looser than the transcribe
  // caps — they exist to bound table growth from rows nobody can be billed for.
  ANON_QUOTE_DEVICE_DAILY: envInt("KSQ_ANON_QUOTE_DEVICE_DAILY", 10),
  ANON_QUOTE_IP_DAILY: envInt("KSQ_ANON_QUOTE_IP_DAILY", 20),
} as const;

type QuotaScope =
  | "global"
  | "device"
  | "ip"
  | "user"
  | "quote_device"
  | "quote_ip";

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

// Independent failure domain from Supabase. Used as the backstop for the
// global spend cap so a database wobble does not silently remove the only
// thing bounding our Groq bill.
let cachedRedis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  cachedRedis = url && token ? new Redis({ url, token }) : null;
  return cachedRedis;
}

async function consumeViaRedis(
  scope: QuotaScope,
  identifier: string,
  limit: number
): Promise<GuardResult | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const key = `ksq:quota:${scope}:${identifier}:${todayUtc()}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, secondsUntilUtcMidnight());

    if (count > limit) {
      return { allowed: false, remaining: 0, retryAfter: secondsUntilUtcMidnight() };
    }
    return { allowed: true, remaining: Math.max(0, limit - count), retryAfter: 0 };
  } catch (err) {
    console.error("[costGuard] Redis fallback failed:", err);
    return null;
  }
}

interface ConsumeOptions {
  /**
   * What to do when no counter can be reached at all.
   *
   * "open"   — per-user and per-device fairness limits. Blocking a paying
   *            customer because our database hiccuped is the worse outcome.
   * "closed" — the global spend cap. Its entire purpose is to bound an
   *            unbounded, unrecoverable cost; failing open deletes the
   *            protection at exactly the moment it is most likely needed.
   */
  onFailure: "open" | "closed";
}

async function consume(
  scope: QuotaScope,
  identifier: string,
  limit: number,
  { onFailure }: ConsumeOptions = { onFailure: "open" }
): Promise<GuardResult> {
  const supabase = getServerSupabase();

  const giveUp = (reason: string): GuardResult => {
    if (onFailure === "closed") {
      console.error(`[costGuard] ${reason} — failing closed on ${scope}`);
      return { allowed: false, remaining: 0, retryAfter: 60 };
    }
    console.warn(`[costGuard] ${reason} — allowing ${scope}`);
    return { allowed: true, remaining: limit, retryAfter: 0 };
  };

  if (supabase) {
    const { data, error } = await supabase.rpc(
      "increment_transcribe_quota_if_allowed",
      {
        p_scope: scope,
        p_identifier: identifier,
        p_date: todayUtc(),
        p_limit: limit,
      }
    );

    if (!error) {
      const newCount = data as number;
      if (newCount === -1) {
        return {
          allowed: false,
          remaining: 0,
          retryAfter: secondsUntilUtcMidnight(),
        };
      }
      return {
        allowed: true,
        remaining: Math.max(0, limit - newCount),
        retryAfter: 0,
      };
    }

    console.error("[costGuard] RPC error:", error.message);
  }

  // Supabase unavailable or erroring. Try the independent counter before
  // deciding anything.
  const viaRedis = await consumeViaRedis(scope, identifier, limit);
  if (viaRedis) return viaRedis;

  return giveUp(
    supabase ? "quota RPC failed and Redis unavailable" : "Supabase not configured"
  );
}

/**
 * Global daily transcribe cap. Two pools, so anonymous and free-tier traffic
 * cannot exhaust the allowance that paying customers depend on.
 */
export async function checkGlobalTranscribeCap(
  paid: boolean
): Promise<GuardResult> {
  return consume(
    "global",
    paid ? "paid" : "free",
    paid
      ? LIMITS.GLOBAL_DAILY_TRANSCRIBES_PAID
      : LIMITS.GLOBAL_DAILY_TRANSCRIBES_FREE,
    { onFailure: "closed" }
  );
}

// Per-device / per-IP daily caps on anonymous quote *creation*. Separate
// scopes from the transcribe caps so a tradie who types a quote does not
// consume their voice allowance, and vice versa.
export async function checkAnonQuoteDeviceQuota(
  deviceToken: string
): Promise<GuardResult> {
  return consume(
    "quote_device",
    hashIdentifier(deviceToken),
    LIMITS.ANON_QUOTE_DEVICE_DAILY
  );
}

export async function checkAnonQuoteIpQuota(ip: string): Promise<GuardResult> {
  return consume("quote_ip", hashIdentifier(ip), LIMITS.ANON_QUOTE_IP_DAILY);
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
export const __testing = {
  resetRedisCache: () => {
    cachedRedis = undefined;
  },
};

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
