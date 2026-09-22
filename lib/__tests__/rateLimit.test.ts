import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { rateLimit, globalIpRateLimit, __testing } from "../rateLimit";

function mockRequest(ip: string, pathname: string): NextRequest {
  return {
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "x-forwarded-for" ? ip : null,
    },
    nextUrl: { pathname },
  } as unknown as NextRequest;
}

describe("rateLimit (in-memory fallback)", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __testing.clearMemory();
    __testing.clearUpstashCache();
  });

  it("allows requests below the limit", async () => {
    const req = mockRequest("1.2.3.4", "/api/foo");
    for (let i = 0; i < 3; i++) {
      const res = await rateLimit(req, { limit: 3, windowSeconds: 60 });
      expect(res).toBeNull();
    }
  });

  it("returns 429 with Retry-After once limit is exceeded", async () => {
    const req = mockRequest("1.2.3.4", "/api/foo");
    for (let i = 0; i < 3; i++) {
      await rateLimit(req, { limit: 3, windowSeconds: 60 });
    }
    const res = await rateLimit(req, { limit: 3, windowSeconds: 60 });
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get("Retry-After")).toBeTruthy();
  });

  it("scopes limits per IP + pathname", async () => {
    const a = mockRequest("1.1.1.1", "/api/foo");
    const b = mockRequest("2.2.2.2", "/api/foo");
    const c = mockRequest("1.1.1.1", "/api/bar");

    for (let i = 0; i < 3; i++) {
      await rateLimit(a, { limit: 3, windowSeconds: 60 });
    }
    expect(await rateLimit(a, { limit: 3, windowSeconds: 60 })).not.toBeNull();
    // Different IP, different pathname — both unaffected.
    expect(await rateLimit(b, { limit: 3, windowSeconds: 60 })).toBeNull();
    expect(await rateLimit(c, { limit: 3, windowSeconds: 60 })).toBeNull();
  });

  it("falls back to 'unknown' when no IP header is present", async () => {
    const req = {
      headers: { get: () => null },
      nextUrl: { pathname: "/api/x" },
    } as unknown as NextRequest;

    expect(
      await rateLimit(req, { limit: 1, windowSeconds: 60 })
    ).toBeNull();
    expect(
      await rateLimit(req, { limit: 1, windowSeconds: 60 })
    ).not.toBeNull();
  });

  it("resets after the window elapses", async () => {
    vi.useFakeTimers();
    const req = mockRequest("9.9.9.9", "/api/foo");
    try {
      await rateLimit(req, { limit: 1, windowSeconds: 1 });
      expect(
        await rateLimit(req, { limit: 1, windowSeconds: 1 })
      ).not.toBeNull();

      vi.advanceTimersByTime(1500);
      expect(await rateLimit(req, { limit: 1, windowSeconds: 1 })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("globalIpRateLimit (in-memory fallback)", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __testing.clearMemory();
    __testing.clearUpstashCache();
  });

  it("shares the bucket across pathnames (IP-wide)", async () => {
    const a = mockRequest("7.7.7.7", "/api/alpha");
    const b = mockRequest("7.7.7.7", "/api/beta");

    expect(
      await globalIpRateLimit(a, { limit: 2, windowSeconds: 60 })
    ).toBeNull();
    expect(
      await globalIpRateLimit(b, { limit: 2, windowSeconds: 60 })
    ).toBeNull();
    // Third request from the same IP — any pathname — should be blocked.
    const blocked = await globalIpRateLimit(a, {
      limit: 2,
      windowSeconds: 60,
    });
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it("keeps different IPs in separate buckets", async () => {
    const a = mockRequest("1.1.1.1", "/api/x");
    const b = mockRequest("2.2.2.2", "/api/x");

    await globalIpRateLimit(a, { limit: 1, windowSeconds: 60 });
    expect(
      await globalIpRateLimit(a, { limit: 1, windowSeconds: 60 })
    ).not.toBeNull();
    // Different IP still allowed.
    expect(
      await globalIpRateLimit(b, { limit: 1, windowSeconds: 60 })
    ).toBeNull();
  });
});

describe("Upstash client selection", () => {
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    __testing.clearUpstashCache();
    __testing.clearMemory();
    __testing.resetCircuitBreaker();
  });

  it("uses in-memory fallback when env vars are absent", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const req = mockRequest("5.5.5.5", "/api/foo");

    // Deterministic sync behaviour proves we didn't hit the network.
    const start = Date.now();
    await rateLimit(req, { limit: 1, windowSeconds: 60 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it("gracefully falls back to in-memory rate limiter when Upstash throws fetch failed", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://handy-husky-102498.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    __testing.clearUpstashCache();

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("fetch failed"));

    const req = mockRequest("8.8.8.8", "/api/quotes/bind");

    // Should not throw, should use in-memory fallback
    const res1 = await rateLimit(req, { limit: 1, windowSeconds: 60 });
    expect(res1).toBeNull();

    // Second request within window should be rate-limited by in-memory store
    const res2 = await rateLimit(req, { limit: 1, windowSeconds: 60 });
    expect(res2).not.toBeNull();
    expect(res2!.status).toBe(429);

    fetchSpy.mockRestore();
  });

  it("skips contacting Upstash while circuit breaker is cooling down", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://handy-husky-102498.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    __testing.clearUpstashCache();

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("fetch failed"));

    const req = mockRequest("6.6.6.6", "/api/test");

    // First call fails and trips the circuit breaker
    await rateLimit(req, { limit: 5, windowSeconds: 60 });
    expect(fetchSpy).toHaveBeenCalled();
    const callsAfterFirst = fetchSpy.mock.calls.length;

    // Subsequent calls during cooldown should not call fetch at all
    await rateLimit(req, { limit: 5, windowSeconds: 60 });
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
    expect(__testing.isUpstashAvailable()).toBe(false);

    fetchSpy.mockRestore();
  });

  it("gracefully falls back in globalIpRateLimit when Upstash throws fetch failed", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://handy-husky-102498.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    __testing.clearUpstashCache();

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new TypeError("fetch failed"));

    const req = mockRequest("8.8.8.9", "/api/transcribe");

    const res1 = await globalIpRateLimit(req, { limit: 1, windowSeconds: 60 });
    expect(res1).toBeNull();

    const res2 = await globalIpRateLimit(req, { limit: 1, windowSeconds: 60 });
    expect(res2).not.toBeNull();
    expect(res2!.status).toBe(429);

    fetchSpy.mockRestore();
  });
});


