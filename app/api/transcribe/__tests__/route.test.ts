import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Groq SDK — must use class to be constructor-compatible
const mockCreate = vi.fn();

vi.mock("groq-sdk", () => {
  return {
    default: class MockGroq {
      audio = {
        transcriptions: {
          create: mockCreate,
        },
      };
    },
  };
});

// Use a realistic tier-bounded remaining value (Team daily cap is 20) instead of
// a sentinel like 99999 — keeps the "no unlimited path" invariant visible even
// in test fixtures.
const mockConsumeUserDailyQuota = vi.fn().mockResolvedValue({
  allowed: true,
  remaining: 19,
  retryAfter: 0,
});

// The route peeks before calling Groq and consumes only after it returns, so
// a failed transcription costs the user nothing.
const mockPeekUserDailyQuota = vi.fn().mockResolvedValue({
  allowed: true,
  remaining: 19,
  retryAfter: 0,
});

// Bypass the daily quota guards for unit tests — they're covered by the
// Supabase-integration tests for costGuard directly.
const mockCheckGlobalTranscribeCap = vi
  .fn()
  .mockResolvedValue({ allowed: true, remaining: 199, retryAfter: 0 });
const mockCheckAnonDeviceQuota = vi
  .fn()
  .mockResolvedValue({ allowed: true, remaining: 2, retryAfter: 0 });
const mockCheckAnonIpQuota = vi
  .fn()
  .mockResolvedValue({ allowed: true, remaining: 4, retryAfter: 0 });

vi.mock("@/lib/costGuard", () => ({
  LIMITS: { GLOBAL_DAILY_TRANSCRIBES: 200, ANON_DEVICE_DAILY: 3, ANON_IP_DAILY: 5 },
  checkGlobalTranscribeCap: mockCheckGlobalTranscribeCap,
  checkAnonDeviceQuota: mockCheckAnonDeviceQuota,
  checkAnonIpQuota: mockCheckAnonIpQuota,
  consumeUserDailyQuota: mockConsumeUserDailyQuota,
  peekUserDailyQuota: mockPeekUserDailyQuota,
  hashIdentifier: (v: string) => `hashed:${v}`,
}));

const mockGetCurrentUserServer = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/supabase/auth-server", () => ({
  getCurrentUserServer: mockGetCurrentUserServer,
}));

// Bypass burst rate limiter — tests fire many requests back-to-back from the
// same IP/token, which would exhaust the 10/min cap and mask quota assertions.
// Burst protection is exercised in lib/rateLimit's own unit tests.
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockResolvedValue(null),
}));

const mockGetUserTier = vi.fn().mockResolvedValue("free");
const mockGetMonthlyUsage = vi
  .fn()
  .mockResolvedValue({ quotesCreated: 0, emailsSent: 0 });
const mockCheckAndIncrementUsage = vi
  .fn()
  .mockResolvedValue({ allowed: true, limit: 5, used: 1 });

vi.mock("@/lib/supabase/subscription", () => ({
  TIER_LIMITS: {
    free: { quotesPerMonth: 5, quotesPerDay: 3, emailsPerMonth: 5 },
    pro: { quotesPerMonth: 100, quotesPerDay: 20, emailsPerMonth: 100 },
    team: { quotesPerMonth: 500, quotesPerDay: 50, emailsPerMonth: 500 },
  },
  getUserTier: mockGetUserTier,
  getMonthlyUsage: mockGetMonthlyUsage,
  checkAndIncrementUsage: mockCheckAndIncrementUsage,
}));

const { POST } = await import("../route");

function makeFormData(file?: File): FormData {
  const formData = new FormData();
  if (file) {
    formData.append("audio", file);
  }
  return formData;
}

function makeRequest(formData: FormData, headers: Record<string, string> = {}): Request {
  const defaultHeaders: Record<string, string> = {
    "x-device-token": "dt_test_device",
    "x-forwarded-for": "127.0.0.1",
    ...headers,
  };
  return {
    formData: () => Promise.resolve(formData),
    headers: {
      get: (name: string) => defaultHeaders[name.toLowerCase()] ?? null,
    },
  } as unknown as Request;
}

describe("POST /api/transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GROQ_API_KEY", "test-key");

    // Reset mocks to permissive defaults — individual tests override.
    mockCheckGlobalTranscribeCap.mockResolvedValue({
      allowed: true,
      remaining: 199,
      retryAfter: 0,
    });
    mockCheckAnonDeviceQuota.mockResolvedValue({
      allowed: true,
      remaining: 2,
      retryAfter: 0,
    });
    mockCheckAnonIpQuota.mockResolvedValue({
      allowed: true,
      remaining: 4,
      retryAfter: 0,
    });
    mockConsumeUserDailyQuota.mockResolvedValue({
      allowed: true,
      remaining: 19,
      retryAfter: 0,
    });
    mockGetCurrentUserServer.mockResolvedValue(null);
    mockGetUserTier.mockResolvedValue("free");
    mockGetMonthlyUsage.mockResolvedValue({ quotesCreated: 0, emailsSent: 0 });
    mockCheckAndIncrementUsage.mockResolvedValue({
      allowed: true,
      limit: 5,
      used: 1,
    });
  });

  it("returns 400 when no audio file provided", async () => {
    const formData = makeFormData();
    const response = await POST(makeRequest(formData) as never);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("No audio file");
  });

  it("returns 400 when audio file exceeds 25MB", async () => {
    const bigFile = new File(["x"], "big.webm", { type: "audio/webm" });
    Object.defineProperty(bigFile, "size", { value: 26 * 1024 * 1024 });

    const formData = makeFormData(bigFile);
    const response = await POST(makeRequest(formData) as never);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("too large");
  });

  it("returns 500 when GROQ_API_KEY is missing", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const file = new File(["audio"], "test.webm", { type: "audio/webm" });
    const formData = makeFormData(file);
    const response = await POST(makeRequest(formData) as never);
    expect(response.status).toBe(500);
  });

  it("returns transcribed text on success", async () => {
    mockCreate.mockResolvedValueOnce({ text: "Fix the kitchen tap mate" });

    const file = new File(["audio-data"], "recording.webm", { type: "audio/webm" });
    const formData = makeFormData(file);
    const response = await POST(makeRequest(formData) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.text).toBe("Fix the kitchen tap mate");
  });

  it("returns 429 on rate limit error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("rate limit exceeded"));

    const file = new File(["audio-data"], "recording.webm", { type: "audio/webm" });
    const formData = makeFormData(file);
    const response = await POST(makeRequest(formData) as never);
    expect(response.status).toBe(429);
  });

  it("returns 401 on invalid API key", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Invalid API Key"));

    const file = new File(["audio-data"], "recording.webm", { type: "audio/webm" });
    const formData = makeFormData(file);
    const response = await POST(makeRequest(formData) as never);
    expect(response.status).toBe(401);
  });

  describe("quota boundaries", () => {
    function makeAudioFile(): File {
      return new File(["audio-data"], "recording.webm", { type: "audio/webm" });
    }

    it("returns 503 when global daily cap is exhausted (checked first)", async () => {
      mockCheckGlobalTranscribeCap.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 3600,
      });

      const response = await POST(
        makeRequest(makeFormData(makeAudioFile())) as never
      );

      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.error).toBe("daily_capacity_reached");
      expect(response.headers.get("Retry-After")).toBe("3600");
      // Groq must NOT be called when global cap is hit
      expect(mockCreate).not.toHaveBeenCalled();
      // Anonymous-specific guards must NOT run after global rejects
      expect(mockCheckAnonDeviceQuota).not.toHaveBeenCalled();
    });

    it("anonymous: returns 400 when device token header is missing", async () => {
      const response = await POST(
        makeRequest(makeFormData(makeAudioFile()), {
          "x-device-token": "",
        }) as never
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("device_token_required");
      expect(mockCheckAnonDeviceQuota).not.toHaveBeenCalled();
    });

    it("anonymous: returns 429 with action=login_required when device daily quota exhausted", async () => {
      mockCheckAnonDeviceQuota.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 7200,
      });

      const response = await POST(
        makeRequest(makeFormData(makeAudioFile())) as never
      );

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe("anon_quota_exceeded");
      expect(data.action).toBe("login_required");
      expect(data.limit).toBe(3);
      expect(response.headers.get("Retry-After")).toBe("7200");
      // IP guard must NOT run after device guard rejects
      expect(mockCheckAnonIpQuota).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("anonymous: returns 429 with action=login_required when IP daily quota exhausted", async () => {
      mockCheckAnonIpQuota.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 1800,
      });

      const response = await POST(
        makeRequest(makeFormData(makeAudioFile())) as never
      );

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe("anon_quota_exceeded");
      expect(data.action).toBe("login_required");
      expect(data.limit).toBe(5);
      expect(response.headers.get("Retry-After")).toBe("1800");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("anonymous: at-limit boundary — last allowed call still transcribes", async () => {
      mockCheckAnonDeviceQuota.mockResolvedValueOnce({
        allowed: true,
        remaining: 0, // last allowed
        retryAfter: 0,
      });
      mockCreate.mockResolvedValueOnce({ text: "last call" });

      const response = await POST(
        makeRequest(makeFormData(makeAudioFile())) as never
      );

      expect(response.status).toBe(200);
      expect(mockCreate).toHaveBeenCalledOnce();
    });

    it("logged-in: returns 429 quota_exceeded when monthly tier limit reached", async () => {
      mockGetCurrentUserServer.mockResolvedValueOnce({
        id: "user-1",
        email: "u@example.com",
      });
      mockGetUserTier.mockResolvedValueOnce("free");
      mockGetMonthlyUsage.mockResolvedValueOnce({
        quotesCreated: 5,
        emailsSent: 0,
      });

      const response = await POST(
        makeRequest(makeFormData(makeAudioFile())) as never
      );

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe("quota_exceeded");
      expect(data.tier).toBe("free");
      expect(data.limit).toBe(5);
      expect(data.used).toBe(5);
      expect(mockCreate).not.toHaveBeenCalled();
      // Anonymous guards must NOT run for logged-in users
      expect(mockCheckAnonDeviceQuota).not.toHaveBeenCalled();
    });

    it("logged-in: returns 429 daily_quota_exceeded when daily cap reached", async () => {
      mockGetCurrentUserServer.mockResolvedValueOnce({
        id: "user-1",
        email: "u@example.com",
      });
      mockPeekUserDailyQuota.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 3600,
      });

      const response = await POST(
        makeRequest(makeFormData(makeAudioFile())) as never
      );

      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toBe("daily_quota_exceeded");
      expect(data.tier).toBe("free");
      expect(response.headers.get("Retry-After")).toBe("3600");
      expect(mockCreate).not.toHaveBeenCalled();
      // Rejected before Groq, so nothing was spent and nothing consumed.
      expect(mockConsumeUserDailyQuota).not.toHaveBeenCalled();
    });

    it("logged-in: monthly under-limit + daily under-limit → transcribes", async () => {
      mockGetCurrentUserServer.mockResolvedValueOnce({
        id: "user-1",
        email: "u@example.com",
      });
      mockGetUserTier.mockResolvedValueOnce("free");
      mockGetMonthlyUsage.mockResolvedValueOnce({
        quotesCreated: 2,
        emailsSent: 0,
      });
      mockCreate.mockResolvedValueOnce({ text: "kitchen tap" });

      const response = await POST(
        makeRequest(makeFormData(makeAudioFile())) as never
      );

      expect(response.status).toBe(200);
      // Charged exactly once, and only after Groq came back.
      expect(mockConsumeUserDailyQuota).toHaveBeenCalledTimes(1);
    });

    // The regression this ordering exists to prevent: a tradie recording in a
    // dead spot fails, the offline queue retries every 60s, and each attempt
    // used to burn another daily slot for a quote that never materialised.
    it("does not charge a daily slot when the Groq call fails", async () => {
      mockGetCurrentUserServer.mockResolvedValueOnce({
        id: "user-1",
        email: "u@example.com",
      });
      mockGetUserTier.mockResolvedValueOnce("free");
      mockGetMonthlyUsage.mockResolvedValueOnce({
        quotesCreated: 2,
        emailsSent: 0,
      });
      mockCreate.mockRejectedValueOnce(new Error("network timeout"));

      const response = await POST(
        makeRequest(makeFormData(makeAudioFile())) as never
      );

      expect(response.status).toBe(500);
      expect(mockPeekUserDailyQuota).toHaveBeenCalledTimes(1);
      expect(mockConsumeUserDailyQuota).not.toHaveBeenCalled();
    });

    it("still returns the transcription when a concurrent request took the last slot", async () => {
      mockGetCurrentUserServer.mockResolvedValueOnce({
        id: "user-1",
        email: "u@example.com",
      });
      mockGetUserTier.mockResolvedValueOnce("free");
      mockGetMonthlyUsage.mockResolvedValueOnce({
        quotesCreated: 2,
        emailsSent: 0,
      });
      mockCreate.mockResolvedValueOnce({ text: "kitchen tap" });
      // Peek passed, but the slot was gone by the time we consumed.
      mockConsumeUserDailyQuota.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        retryAfter: 3600,
      });

      const response = await POST(
        makeRequest(makeFormData(makeAudioFile())) as never
      );

      // Groq has already been paid for — don't throw the result away.
      expect(response.status).toBe(200);
      expect((await response.json()).text).toBe("kitchen tap");
    });

    it("does NOT increment quotes_created — /api/quotes owns that counter", async () => {
      // Counting here would double-charge the voice flow (transcribe + the
      // quote row it produces) and would still miss manually-typed quotes,
      // which never reach this route.
      mockGetCurrentUserServer.mockResolvedValueOnce({
        id: "user-1",
        email: "u@example.com",
      });
      mockGetUserTier.mockResolvedValueOnce("free");
      mockGetMonthlyUsage.mockResolvedValueOnce({
        quotesCreated: 2,
        emailsSent: 0,
      });
      mockCreate.mockResolvedValueOnce({ text: "kitchen tap" });

      const response = await POST(
        makeRequest(makeFormData(makeAudioFile())) as never
      );

      expect(response.status).toBe(200);
      expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
    });
  });
});
