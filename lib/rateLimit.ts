import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

// ---------------------------------------------------------------------------
// In-memory fallback (cold-start and per-instance only — used when Upstash
// env vars are missing, typically during local dev).
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();
let lastCleanup = Date.now();

function cleanupMemory() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, entry] of memoryStore) {
    if (entry.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}

function checkMemory(
  key: string,
  limit: number,
  windowSeconds: number
): { allowed: boolean; retryAfter: number } {
  cleanupMemory();
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfter: 0 };
  }

  entry.count++;
  if (entry.count > limit) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }
  return { allowed: true, retryAfter: 0 };
}

// ---------------------------------------------------------------------------
// Upstash Redis-backed limiter (shared across all Lambda instances).
// Cached per-window so each distinct window reuses a single Ratelimit client.
// ---------------------------------------------------------------------------

const upstashLimiters = new Map<string, Ratelimit>();
let upstashDisabledUntil = 0;
const UPSTASH_COOLDOWN_MS = 30_000;

function isUpstashAvailable(): boolean {
  return Date.now() >= upstashDisabledUntil;
}

function handleUpstashFailure(error: unknown) {
  upstashDisabledUntil = Date.now() + UPSTASH_COOLDOWN_MS;
  console.warn(
    `[rateLimit] Upstash Redis call failed; falling back to in-memory limiter for 30s. Reason:`,
    error instanceof Error ? error.message : String(error)
  );
}

function getUpstashClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({
    url,
    token,
    retry: {
      retries: 1,
      backoff: () => 50,
    },
  });
}

function getUpstashLimiter(
  limit: number,
  windowSeconds: number
): Ratelimit | null {
  const key = `${limit}:${windowSeconds}`;
  const cached = upstashLimiters.get(key);
  if (cached) return cached;

  const redis = getUpstashClient();
  if (!redis) return null;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    analytics: false,
    prefix: "ksq:rl",
  });
  upstashLimiters.set(key, limiter);
  return limiter;
}

async function evaluateLimit(
  limiter: Ratelimit | null,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; retryAfter: number }> {
  if (limiter && isUpstashAvailable()) {
    try {
      const result = await limiter.limit(key);
      return {
        allowed: result.success,
        retryAfter: Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
      };
    } catch (error) {
      handleUpstashFailure(error);
    }
  }
  return checkMemory(key, limit, windowSeconds);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function getClientIp(request: NextRequest): string {
  return (
    request.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers?.get?.("x-real-ip") ||
    "unknown"
  );
}

/**
 * Rate-limit a request. Uses Upstash Redis when configured, otherwise falls
 * back to an in-memory map (fine for local dev but not reliable in
 * multi-instance production).
 *
 * Returns null when allowed, or a 429 NextResponse when the limit is hit.
 */
export async function rateLimit(
  request: NextRequest,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  const { limit, windowSeconds } = options;
  const ip = getClientIp(request);
  const pathname = request.nextUrl?.pathname || "unknown";
  const key = `${ip}:${pathname}`;

  const limiter = getUpstashLimiter(limit, windowSeconds);
  const { allowed, retryAfter } = await evaluateLimit(
    limiter,
    key,
    limit,
    windowSeconds
  );

  if (allowed) return null;

  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
      },
    }
  );
}

/**
 * Coarse global per-IP limit for middleware. Checks an aggregate key that is
 * independent of the route — protects overall API surface from floods.
 */
export async function globalIpRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  const { limit, windowSeconds } = options;
  const ip = getClientIp(request);
  const key = `global:${ip}`;

  const limiter = getUpstashLimiter(limit, windowSeconds);
  const { allowed, retryAfter } = await evaluateLimit(
    limiter,
    key,
    limit,
    windowSeconds
  );

  if (allowed) return null;

  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
      },
    }
  );
}

export const __testing = {
  clearMemory: () => memoryStore.clear(),
  clearUpstashCache: () => upstashLimiters.clear(),
  resetCircuitBreaker: () => {
    upstashDisabledUntil = 0;
  },
  isUpstashAvailable: () => isUpstashAvailable(),
};
