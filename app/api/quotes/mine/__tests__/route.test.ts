import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getServerSupabase: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn(() => null),
}));

const mockGetCurrentUserServer = vi.fn();
vi.mock("@/lib/supabase/auth-server", () => ({
  getCurrentUserServer: () => mockGetCurrentUserServer(),
}));

import { GET } from "../route";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/quotes/mine", {
    method: "GET",
  });
}

function mockChain(finalResult: { data?: unknown; error?: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(finalResult),
  };
  return chain;
}

describe("GET /api/quotes/mine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no authenticated user", async () => {
    mockGetCurrentUserServer.mockResolvedValueOnce(null);

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/auth/i);
  });

  it("returns only quotes belonging to the authenticated user", async () => {
    mockGetCurrentUserServer.mockResolvedValueOnce({ id: "user-abc" });
    const fakeRows = [
      { id: "q1", user_id: "user-abc", customer_name: "Alice" },
      { id: "q2", user_id: "user-abc", customer_name: "Bob" },
    ];
    const chain = mockChain({ data: fakeRows, error: null });
    mockFrom.mockReturnValueOnce(chain);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quotes).toHaveLength(2);
    expect(mockFrom).toHaveBeenCalledWith("quotes");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-abc");
  });

  it("returns 500 on Supabase error", async () => {
    mockGetCurrentUserServer.mockResolvedValueOnce({ id: "user-abc" });
    const chain = mockChain({
      data: null,
      error: { message: "DB exploded" },
    });
    mockFrom.mockReturnValueOnce(chain);

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
  });

  it("returns empty array when user has no quotes", async () => {
    mockGetCurrentUserServer.mockResolvedValueOnce({ id: "user-abc" });
    const chain = mockChain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(chain);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quotes).toEqual([]);
  });
});
