import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mock Supabase server client (dispatch by table name) ---
const mockQuoteRow = vi.fn();
const mockProfileRow = vi.fn();

function tableChain(result: { data?: unknown; error?: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  getServerSupabase: vi.fn(() => ({
    from: (table: string) =>
      table === "profiles" ? tableChain(mockProfileRow()) : tableChain(mockQuoteRow()),
  })),
}));

// --- Mock rate limiter (allow all) ---
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn(() => null),
}));

// --- Mock idempotency (first call by default) ---
const mockClaimIdempotencyKey = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/idempotency", () => ({
  claimIdempotencyKey: (...a: unknown[]) => mockClaimIdempotencyKey(...a),
}));

// --- Mock auth ---
const mockGetCurrentUserServer = vi.fn();
vi.mock("@/lib/supabase/auth-server", () => ({
  getCurrentUserServer: () => mockGetCurrentUserServer(),
}));

// --- Mock subscription/quota ---
const mockCheckAndIncrementUsage = vi
  .fn()
  .mockResolvedValue({ allowed: true, limit: 3, used: 1 });
const mockGetMonthlyUsage = vi
  .fn()
  .mockResolvedValue({ quotesCreated: 0, emailsSent: 0 });
const mockGetUserTier = vi.fn().mockResolvedValue("free");

vi.mock("@/lib/supabase/subscription", () => ({
  checkAndIncrementUsage: (...a: unknown[]) => mockCheckAndIncrementUsage(...a),
  getMonthlyUsage: (...a: unknown[]) => mockGetMonthlyUsage(...a),
  getUserTier: (...a: unknown[]) => mockGetUserTier(...a),
  TIER_LIMITS: {
    free: { quotesPerMonth: 5, quotesPerDay: 3, emailsPerMonth: 3, templates: 3, attachmentsPerQuote: 3, versions: 2 },
    pro: { quotesPerMonth: 200, quotesPerDay: 10, emailsPerMonth: 50, templates: 50, attachmentsPerQuote: 20, versions: 10 },
    team: { quotesPerMonth: 400, quotesPerDay: 20, emailsPerMonth: 200, templates: 100, attachmentsPerQuote: 20, versions: 20 },
  },
}));

// --- Mock Resend ---
const mockSend = vi.fn().mockResolvedValue({ error: null });
vi.mock("resend", () => ({
  // Must be constructible — the route does `new Resend(...)`.
  Resend: class {
    emails = { send: (...a: unknown[]) => mockSend(...a) };
  },
}));

import { POST } from "../route";

const OWNER = { id: "user-1", email: "tradie@example.co.nz" };

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/send-quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function sentQuote(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: "quote-1",
      slug: "abc12345",
      status: "sent",
      user_id: OWNER.id,
      customer_name: "Jane Homeowner",
      customer_email: "jane@example.co.nz",
      total: 1234.5,
      ...overrides,
    },
    error: null,
  };
}

describe("POST /api/send-quote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ksq.nz");
    mockGetCurrentUserServer.mockResolvedValue(OWNER);
    mockClaimIdempotencyKey.mockResolvedValue(true);
    mockGetUserTier.mockResolvedValue("free");
    mockGetMonthlyUsage.mockResolvedValue({ quotesCreated: 0, emailsSent: 0 });
    mockCheckAndIncrementUsage.mockResolvedValue({ allowed: true, limit: 3, used: 1 });
    mockQuoteRow.mockReturnValue(sentQuote());
    mockProfileRow.mockReturnValue({
      data: { business_name: "Kiwi Plumbing Ltd" },
      error: null,
    });
    mockSend.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires authentication", async () => {
    mockGetCurrentUserServer.mockResolvedValue(null);
    const res = await POST(makeRequest({ quoteId: "quote-1" }));
    expect(res.status).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("requires a quoteId", async () => {
    const res = await POST(makeRequest({ to: "jane@example.co.nz" }));
    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns 404 when the quote does not exist", async () => {
    mockQuoteRow.mockReturnValue({ data: null, error: null });
    const res = await POST(makeRequest({ quoteId: "nope" }));
    expect(res.status).toBe(404);
    expect(mockSend).not.toHaveBeenCalled();
  });

  // The core of the fix: the route used to accept recipient, link, sender name
  // and amount straight from the body, with no quote and no ownership check.
  it("refuses to email a quote owned by someone else", async () => {
    mockQuoteRow.mockReturnValue(sentQuote({ user_id: "user-2" }));
    const res = await POST(makeRequest({ quoteId: "quote-1" }));
    expect(res.status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("refuses to email an unbound anonymous quote", async () => {
    mockQuoteRow.mockReturnValue(sentQuote({ user_id: null }));
    const res = await POST(makeRequest({ quoteId: "quote-1" }));
    expect(res.status).toBe(403);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("refuses to email a draft, whose public link would 404", async () => {
    mockQuoteRow.mockReturnValue(sentQuote({ status: "draft" }));
    const res = await POST(makeRequest({ quoteId: "quote-1" }));
    expect(res.status).toBe(409);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("derives link, sender name and amount from the quote, ignoring the body", async () => {
    const res = await POST(
      makeRequest({
        quoteId: "quote-1",
        // All of these used to be honoured verbatim.
        quoteUrl: "https://phish.example/login",
        providerName: "ANZ Internet Banking",
        total: "$999,999.00",
        customerName: "Account Verification",
      })
    );

    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);

    const payload = mockSend.mock.calls[0][0];
    expect(payload.from).toBe("Kiwi Plumbing Ltd <quotes@ksq.nz>");
    expect(payload.from).not.toContain("ANZ");
    expect(payload.to).toEqual(["jane@example.co.nz"]);
    expect(payload.html).toContain("https://ksq.nz/q/abc12345");
    expect(payload.html).not.toContain("phish.example");
    expect(payload.html).toContain("1,234.50");
    expect(payload.html).not.toContain("999,999");
    expect(payload.html).toContain("Jane Homeowner");
  });

  it("honours an explicit recipient but still validates it", async () => {
    await POST(makeRequest({ quoteId: "quote-1", to: "other@example.co.nz" }));
    expect(mockSend.mock.calls[0][0].to).toEqual(["other@example.co.nz"]);

    mockSend.mockClear();
    const bad = await POST(makeRequest({ quoteId: "quote-1", to: "not-an-email" }));
    expect(bad.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rejects when the quote has no recipient at all", async () => {
    mockQuoteRow.mockReturnValue(sentQuote({ customer_email: null }));
    const res = await POST(makeRequest({ quoteId: "quote-1" }));
    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("strips header-injection characters from the sender display name", async () => {
    mockProfileRow.mockReturnValue({
      data: { business_name: 'Bob\r\nBcc: victim@example.com <evil@attacker.test>' },
      error: null,
    });
    await POST(makeRequest({ quoteId: "quote-1" }));

    const from = mockSend.mock.calls[0][0].from;
    expect(from).not.toContain("\n");
    expect(from).not.toContain("\r");
    // Colons and angle brackets go too, so nothing in the display name can be
    // read as a header name or as a second address.
    expect(from).toBe("Bob Bcc victim@example.com evil@attacker.test <quotes@ksq.nz>");
  });

  it("does not charge a credit when sending fails", async () => {
    mockSend.mockResolvedValue({ error: { message: "smtp down" } });
    const res = await POST(makeRequest({ quoteId: "quote-1" }));
    expect(res.status).toBe(500);
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
  });

  it("does not charge a credit when the email service is unconfigured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const res = await POST(makeRequest({ quoteId: "quote-1" }));
    expect(res.status).toBe(503);
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
  });

  it("charges exactly one credit on success", async () => {
    const res = await POST(makeRequest({ quoteId: "quote-1" }));
    expect(res.status).toBe(200);
    expect(mockCheckAndIncrementUsage).toHaveBeenCalledTimes(1);
    expect(mockCheckAndIncrementUsage).toHaveBeenCalledWith(OWNER.id, "emails_sent");
  });

  it("blocks and does not send once the monthly quota is spent", async () => {
    mockGetMonthlyUsage.mockResolvedValue({ quotesCreated: 0, emailsSent: 3 });
    const res = await POST(makeRequest({ quoteId: "quote-1" }));
    expect(res.status).toBe(429);
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
  });

  it("deduplicates a double submit instead of sending twice", async () => {
    mockClaimIdempotencyKey.mockResolvedValue(false);
    const res = await POST(makeRequest({ quoteId: "quote-1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).deduplicated).toBe(true);
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
  });

  it("falls back to the request origin when no app URL is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    await POST(makeRequest({ quoteId: "quote-1" }));
    expect(mockSend.mock.calls[0][0].html).toContain(
      "http://localhost:3000/q/abc12345"
    );
  });
});
