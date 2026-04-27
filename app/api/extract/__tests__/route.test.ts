import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mock-model"),
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));

const mockGetCurrentUserServer = vi.fn();
vi.mock("@/lib/supabase/auth-server", () => ({
  getCurrentUserServer: () => mockGetCurrentUserServer(),
}));

const mockCheckAnonDeviceQuota = vi.fn();
const mockCheckAnonIpQuota = vi.fn();
const mockPeekUserDailyQuota = vi.fn();
vi.mock("@/lib/costGuard", () => ({
  checkAnonDeviceQuota: (...a: unknown[]) => mockCheckAnonDeviceQuota(...a),
  checkAnonIpQuota: (...a: unknown[]) => mockCheckAnonIpQuota(...a),
  peekUserDailyQuota: (...a: unknown[]) => mockPeekUserDailyQuota(...a),
  LIMITS: { ANON_DEVICE_DAILY: 5, ANON_IP_DAILY: 20 },
}));

const mockGetUserTier = vi.fn();
const mockGetMonthlyUsage = vi.fn();
vi.mock("@/lib/supabase/subscription", () => ({
  getUserTier: (...a: unknown[]) => mockGetUserTier(...a),
  getMonthlyUsage: (...a: unknown[]) => mockGetMonthlyUsage(...a),
  TIER_LIMITS: {
    free: { quotesPerMonth: 10, quotesPerDay: 3 },
    pro: { quotesPerMonth: 200, quotesPerDay: 10 },
  },
}));

import { generateObject } from "ai";
const mockGenerateObject = vi.mocked(generateObject);

function makeRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): Request {
  return new Request("http://localhost:3000/api/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-device-token": "dt_test",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/extract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    mockGetCurrentUserServer.mockResolvedValue(null);
    mockCheckAnonDeviceQuota.mockResolvedValue({ allowed: true });
    mockCheckAnonIpQuota.mockResolvedValue({ allowed: true });
    mockPeekUserDailyQuota.mockResolvedValue({ allowed: true, remaining: 3 });
  });

  it("returns 400 when no text provided", async () => {
    const request = makeRequest({});
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("No text provided");
  });

  it("returns 400 when text is too short", async () => {
    const request = makeRequest({ text: "Hi" });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("too short");
  });

  it("returns 500 when OPENAI_API_KEY is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const request = makeRequest({ text: "Fix the kitchen tap, about 200 bucks" });
    const response = await POST(request as never);
    expect(response.status).toBe(500);
  });

  it("returns extracted data on success", async () => {
    const mockResult = {
      customerName: "Dave",
      customerPhone: null,
      customerEmail: null,
      customerAddress: null,
      items: [{ description: "Fix kitchen tap", quantity: 1, unitPrice: 200 }],
      notes: null,
      confidence: 0.8,
    };

    mockGenerateObject.mockResolvedValueOnce({ object: mockResult } as never);

    const request = makeRequest({ text: "Fix the kitchen tap for Dave, about 200 bucks" });
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.customerName).toBe("Dave");
    expect(data.items).toHaveLength(1);
    expect(data.confidence).toBe(0.8);
  });

  it("returns 429 on rate limit error", async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error("rate limit exceeded"));
    const request = makeRequest({ text: "Fix the kitchen tap, about 200 bucks" });
    const response = await POST(request as never);
    expect(response.status).toBe(429);
  });

  it("returns 401 on API key error", async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error("Invalid API key"));
    const request = makeRequest({ text: "Fix the kitchen tap, about 200 bucks" });
    const response = await POST(request as never);
    expect(response.status).toBe(401);
  });

  describe("anonymous quota gating", () => {
    it("returns 400 when device token header is missing", async () => {
      const req = new Request("http://localhost:3000/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Fix the kitchen tap, about 200 bucks" }),
      });
      const res = await POST(req as never);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("device_token_required");
    });

    it("returns 429 login_required when device daily quota exhausted", async () => {
      mockCheckAnonDeviceQuota.mockResolvedValueOnce({ allowed: false, retryAfter: 3600 });
      const res = await POST(
        makeRequest({ text: "Fix the kitchen tap, about 200 bucks" }) as never
      );
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.action).toBe("login_required");
    });

    it("returns 429 login_required when IP daily quota exhausted", async () => {
      mockCheckAnonIpQuota.mockResolvedValueOnce({ allowed: false, retryAfter: 3600 });
      const res = await POST(
        makeRequest({ text: "Fix the kitchen tap, about 200 bucks" }) as never
      );
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.action).toBe("login_required");
    });
  });

  describe("logged-in tier quota", () => {
    beforeEach(() => {
      mockGetCurrentUserServer.mockResolvedValue({ id: "user-1" });
    });

    it("returns 429 quota_exceeded when monthly limit reached on free tier", async () => {
      mockGetUserTier.mockResolvedValueOnce("free");
      mockGetMonthlyUsage.mockResolvedValueOnce({ quotesCreated: 10 });
      const res = await POST(
        makeRequest({ text: "Fix the kitchen tap, about 200 bucks" }) as never
      );
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe("quota_exceeded");
      expect(body.tier).toBe("free");
    });

    it("allows logged-in user under monthly limit (no increment performed)", async () => {
      mockGetUserTier.mockResolvedValueOnce("free");
      mockGetMonthlyUsage.mockResolvedValueOnce({ quotesCreated: 3 });
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          customerName: null,
          customerPhone: null,
          customerEmail: null,
          customerAddress: null,
          items: [],
          notes: null,
          confidence: 0.5,
        },
      } as never);

      const res = await POST(
        makeRequest({ text: "Fix the kitchen tap, about 200 bucks" }) as never
      );
      expect(res.status).toBe(200);
    });

    it("returns 429 daily_quota_exceeded when peek says daily exhausted", async () => {
      mockGetUserTier.mockResolvedValueOnce("free");
      mockGetMonthlyUsage.mockResolvedValueOnce({ quotesCreated: 1 });
      mockPeekUserDailyQuota.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 3600,
      });
      const res = await POST(
        makeRequest({ text: "Fix the kitchen tap, about 200 bucks" }) as never
      );
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe("daily_quota_exceeded");
      expect(body.tier).toBe("free");
    });

    it("allows pro tier under its monthly + daily caps", async () => {
      mockGetUserTier.mockResolvedValueOnce("pro");
      mockGetMonthlyUsage.mockResolvedValueOnce({ quotesCreated: 50 });
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          customerName: null,
          customerPhone: null,
          customerEmail: null,
          customerAddress: null,
          items: [],
          notes: null,
          confidence: 0.5,
        },
      } as never);

      const res = await POST(
        makeRequest({ text: "Fix the kitchen tap, about 200 bucks" }) as never
      );
      expect(res.status).toBe(200);
      // Every tier now has a hard cap — both checks must run.
      expect(mockGetMonthlyUsage).toHaveBeenCalledTimes(1);
      expect(mockPeekUserDailyQuota).toHaveBeenCalledTimes(1);
    });

    it("returns 429 quota_exceeded when pro tier hits monthly cap", async () => {
      mockGetUserTier.mockResolvedValueOnce("pro");
      mockGetMonthlyUsage.mockResolvedValueOnce({ quotesCreated: 200 });
      const res = await POST(
        makeRequest({ text: "Fix the kitchen tap, about 200 bucks" }) as never
      );
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe("quota_exceeded");
      expect(body.tier).toBe("pro");
    });
  });
});
