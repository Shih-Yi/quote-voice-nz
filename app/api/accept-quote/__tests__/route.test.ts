import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockQuoteLookup = vi.fn();
const mockUpdateResult = vi.fn();

// `from("quotes")` is used twice: a select for the lookup, then an update.
// Distinguish by which terminal method the route calls on the chain.
vi.mock("@/lib/supabase/server", () => ({
  getServerSupabase: vi.fn(() => ({
    from: () => {
      let isUpdate = false;
      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        update: vi.fn(() => {
          isUpdate = true;
          return chain;
        }),
        single: vi.fn(async () =>
          isUpdate ? mockUpdateResult() : mockQuoteLookup()
        ),
      };
      return chain;
    },
  })),
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn(() => null),
}));

const mockGetUserTier = vi.fn().mockResolvedValue("pro");
vi.mock("@/lib/supabase/subscription", () => ({
  getUserTier: (...a: unknown[]) => mockGetUserTier(...a),
}));

import { POST } from "../route";

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/accept-quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/accept-quote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuoteLookup.mockResolvedValue({
      data: { id: "quote-1", user_id: "user-1", status: "sent" },
      error: null,
    });
    mockUpdateResult.mockResolvedValue({ data: { id: "quote-1" }, error: null });
    mockGetUserTier.mockResolvedValue("pro");
  });

  it("accepts a sent quote from a paid owner", async () => {
    const res = await POST(makeRequest({ slug: "abc12345" }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("blocks acceptance when the owner is on the free plan", async () => {
    mockGetUserTier.mockResolvedValue("free");
    const res = await POST(makeRequest({ slug: "abc12345" }));
    expect(res.status).toBe(403);
  });

  // The caller here is the customer, not our user. Naming the plan would leak
  // the tradie's billing status to a third party who cannot act on it anyway.
  it("does not disclose the owner's subscription tier to the customer", async () => {
    mockGetUserTier.mockResolvedValue("free");
    const res = await POST(makeRequest({ slug: "abc12345" }));
    const message: string = (await res.json()).error;

    expect(message).not.toMatch(/pro|team|plan|upgrade|subscri/i);
    expect(message).toContain("contact the sender");
  });

  it("rejects a quote that is not in sent status", async () => {
    mockQuoteLookup.mockResolvedValue({
      data: { id: "quote-1", user_id: "user-1", status: "draft" },
      error: null,
    });
    const res = await POST(makeRequest({ slug: "abc12345" }));
    expect(res.status).toBe(404);
  });

  it("requires a slug", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });
});
