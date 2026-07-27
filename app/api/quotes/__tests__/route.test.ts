import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHash as nodeCreateHash } from "crypto";

// --- Mock Supabase server client ---
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getServerSupabase: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  })),
}));

// --- Mock rate limiter (allow all by default) ---
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn(() => null),
}));

// --- Mock idempotency (claim slot succeeds by default; override per test) ---
const mockClaimIdempotencyKey = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/idempotency", () => ({
  claimIdempotencyKey: (...a: unknown[]) => mockClaimIdempotencyKey(...a),
}));

// --- Mock auth (anonymous by default; override per test) ---
const mockGetCurrentUserServer = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/supabase/auth-server", () => ({
  getCurrentUserServer: () => mockGetCurrentUserServer(),
}));

// --- Mock subscription/quota ---
const mockCheckAndIncrementUsage = vi
  .fn()
  .mockResolvedValue({ allowed: true, limit: 5, used: 1 });
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

import { POST, DELETE } from "../route";

// --- Helpers ---
function makeRequest(method: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/quotes", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-id-123",
    token: "dt_test_token",
    slug: "abc12345",
    customerName: "Test Customer",
    items: [
      { id: "i1", description: "General Labour", quantity: 2, unitPrice: 85, total: 170 },
    ],
    gstInclusive: false,
    status: "draft",
    ...overrides,
  };
}

// Chain builder for Supabase query mocking
function mockChain(finalResult: { data?: unknown; error?: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(finalResult),
    maybeSingle: vi.fn().mockResolvedValue(finalResult),
    insert: vi.fn().mockResolvedValue(finalResult),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
  return chain;
}

describe("POST /api/quotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClaimIdempotencyKey.mockResolvedValue(true);
    mockGetCurrentUserServer.mockResolvedValue(null);
    mockGetMonthlyUsage.mockResolvedValue({ quotesCreated: 0, emailsSent: 0 });
    mockGetUserTier.mockResolvedValue("free");
    mockCheckAndIncrementUsage.mockResolvedValue({ allowed: true, limit: 5, used: 1 });
  });

  it("returns 400 when id is missing", async () => {
    const req = makeRequest("POST", { token: "t" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("id and token are required");
  });

  it("returns 400 when token is missing", async () => {
    const req = makeRequest("POST", { id: "x" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("id and token are required");
  });

  it("returns 400 when customerName is empty", async () => {
    const req = makeRequest("POST", validPayload({ customerName: "" }));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("customerName is required");
  });

  it("returns 400 for invalid status", async () => {
    const req = makeRequest("POST", validPayload({ status: "invalid" }));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid status");
  });

  it("returns 400 when items is not an array", async () => {
    const req = makeRequest("POST", validPayload({ items: "not-array" }));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("items must be an array");
  });

  it("returns 400 when customerName exceeds max length", async () => {
    const req = makeRequest("POST", validPayload({ customerName: "x".repeat(201) }));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("customerName exceeds maximum length");
  });

  it("returns 400 when notes exceed max length", async () => {
    const req = makeRequest("POST", validPayload({ notes: "x".repeat(5001) }));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("notes exceeds maximum length");
  });

  it("returns 400 when item count exceeds max", async () => {
    const items = Array.from({ length: 101 }, (_, i) => ({
      id: `i${i}`,
      description: "x",
      quantity: 1,
      unitPrice: 1,
      total: 1,
    }));
    const req = makeRequest("POST", validPayload({ items }));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("items exceeds maximum");
  });

  it("returns 400 when item description exceeds max length", async () => {
    const items = [
      { id: "i1", description: "x".repeat(1001), quantity: 1, unitPrice: 1, total: 1 },
    ];
    const req = makeRequest("POST", validPayload({ items }));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("items[0].description exceeds maximum length");
  });

  it("returns 400 when item quantity is negative", async () => {
    const items = [{ id: "i1", description: "x", quantity: -1, unitPrice: 1, total: -1 }];
    const req = makeRequest("POST", validPayload({ items }));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("items[0].quantity must be a non-negative number");
  });

  it("returns 400 when item unitPrice is non-numeric", async () => {
    const items = [{ id: "i1", description: "x", quantity: 1, unitPrice: "abc", total: 0 }];
    const req = makeRequest("POST", validPayload({ items }));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("items[0].unitPrice must be a non-negative number");
  });

  it("recomputes item.total and items_sum server-side — ignores client-sent totals", async () => {
    const { createHash } = await import("crypto");
    const tokenHash = createHash("sha256").update("dt_test_token").digest("hex");

    // Client tries to sneak a $0 total for a $170 job.
    const tamperedItems = [
      { id: "i1", description: "Labour", quantity: 2, unitPrice: 85, total: 0 },
      { id: "i2", description: "Parts", quantity: 3, unitPrice: 20, total: 999 },
    ];

    const selectChain = mockChain({ data: null, error: null });

    const upsertFn = vi.fn().mockReturnThis();
    const upsertChain = {
      select: vi.fn().mockResolvedValue({
        data: [{ id: "test-id-123", owner_token_hash: tokenHash }],
        error: null,
      }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: upsertFn,
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return selectChain;
      return upsertChain;
    });

    const req = makeRequest("POST", validPayload({ items: tamperedItems }));
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Inspect the row actually written to the DB.
    const row = upsertFn.mock.calls[0][0];
    expect(row.items[0].total).toBe(170); // 2 * 85
    expect(row.items[1].total).toBe(60);  // 3 * 20
    expect(row.items_sum).toBe(230);      // 170 + 60, not 0 + 999
  });

  it("inserts a new quote when it does not exist", async () => {
    const { createHash } = await import("crypto");
    const tokenHash = createHash("sha256").update("dt_test_token").digest("hex");

    const selectChain = mockChain({ data: null, error: null });

    // upsert().select() chain: select must be the terminal promise.
    // Returned row includes owner_token_hash so the post-upsert ownership check passes.
    const upsertChain = {
      select: vi.fn().mockResolvedValue({
        data: [{ id: "test-id-123", owner_token_hash: tokenHash }],
        error: null,
      }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return selectChain;
      return upsertChain;
    });

    const req = makeRequest("POST", validPayload());
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // ─── Quota accounting (audit low #5) ──────────────────

  describe("quota accounting", () => {
    const tokenHash = nodeCreateHash("sha256")
      .update("dt_test_token")
      .digest("hex");

    // `ownerUserId` must mirror the session user — the post-upsert ownership
    // check compares the written row against the caller.
    function mockInsertFlow(
      existing: Record<string, unknown> | null,
      ownerUserId: string | null = "user-1"
    ) {
      const selectChain = mockChain({ data: existing, error: null });
      const upsertChain = {
        select: vi.fn().mockResolvedValue({
          data: [
            {
              id: "test-id-123",
              owner_token_hash: tokenHash,
              user_id: ownerUserId,
              updated_at: "2026-07-27T00:00:00.000Z",
            },
          ],
          error: null,
        }),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      };

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? selectChain : upsertChain;
      });
    }

    it("counts a new quote for a logged-in user, whatever created it", async () => {
      mockGetCurrentUserServer.mockResolvedValue({ id: "user-1" });
      mockInsertFlow(null);

      const res = await POST(makeRequest("POST", validPayload()));

      expect(res.status).toBe(200);
      expect(mockCheckAndIncrementUsage).toHaveBeenCalledWith(
        "user-1",
        "quotes_created"
      );
    });

    it("does not count an edit to an existing quote", async () => {
      mockGetCurrentUserServer.mockResolvedValue({ id: "user-1" });
      mockInsertFlow({ owner_token_hash: tokenHash, user_id: "user-1", status: "draft" });

      const res = await POST(makeRequest("POST", validPayload()));

      expect(res.status).toBe(200);
      expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
    });

    it("does not count anonymous quotes — they have no usage row", async () => {
      mockGetCurrentUserServer.mockResolvedValue(null);
      mockInsertFlow(null, null);

      const res = await POST(makeRequest("POST", validPayload()));

      expect(res.status).toBe(200);
      expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
    });

    it("rejects with 429 quota_exceeded before writing when the plan is used up", async () => {
      mockGetCurrentUserServer.mockResolvedValue({ id: "user-1" });
      mockGetMonthlyUsage.mockResolvedValue({ quotesCreated: 5, emailsSent: 0 });
      mockInsertFlow(null);

      const res = await POST(makeRequest("POST", validPayload()));

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe("quota_exceeded");
      expect(mockCheckAndIncrementUsage).not.toHaveBeenCalled();
    });

    it("returns the server's authoritative updatedAt so local copies can match", async () => {
      mockGetCurrentUserServer.mockResolvedValue({ id: "user-1" });
      mockInsertFlow(null);

      const res = await POST(makeRequest("POST", validPayload()));
      const body = await res.json();

      expect(body.updatedAt).toBe("2026-07-27T00:00:00.000Z");
    });
  });

  it("updates an existing quote with matching token", async () => {
    const { createHash } = await import("crypto");
    const tokenHash = createHash("sha256").update("dt_test_token").digest("hex");

    const selectChain = mockChain({
      data: { owner_token_hash: tokenHash },
      error: null,
    });

    // upsert().select() — select must be the terminal promise
    const upsertChain = {
      select: vi.fn().mockResolvedValue({
        data: [{ id: "test-id-123", owner_token_hash: tokenHash }],
        error: null,
      }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return selectChain;
      return upsertChain;
    });

    const req = makeRequest("POST", validPayload());
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });


  it("returns 409 when post-upsert ownership hash differs (race)", async () => {
    const selectChain = mockChain({ data: null, error: null });

    // Simulate concurrent write: row we just upserted now has a different token hash
    const upsertChain = {
      select: vi.fn().mockResolvedValue({
        data: [{ id: "test-id-123", owner_token_hash: "different-hash" }],
        error: null,
      }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return selectChain;
      return upsertChain;
    });

    const req = makeRequest("POST", validPayload());
    const res = await POST(req);
    expect(res.status).toBe(409);
  });


  it("returns 403 when token does not match existing quote", async () => {
    const selectChain = mockChain({
      data: { owner_token_hash: "wrong-hash" },
      error: null,
    });

    mockFrom.mockReturnValue(selectChain);

    const req = makeRequest("POST", validPayload());
    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Access denied");
  });

  it("returns 500 on upsert error", async () => {
    const selectChain = mockChain({ data: null, error: null });

    const upsertChain = {
      select: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return selectChain;
      return upsertChain;
    });

    const req = makeRequest("POST", validPayload());
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  describe("idempotency", () => {
    it("returns cached slug without upsert when same key replays within TTL", async () => {
      mockClaimIdempotencyKey.mockResolvedValueOnce(false);

      const { createHash } = await import("crypto");
      const tokenHash = createHash("sha256")
        .update("dt_test_token")
        .digest("hex");

      const cachedRowChain = mockChain({
        data: { slug: "cached-slug", owner_token_hash: tokenHash, user_id: null },
        error: null,
      });
      mockFrom.mockReturnValue(cachedRowChain);

      const req = makeRequest("POST", validPayload());
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.cached).toBe(true);
      expect(body.slug).toBe("cached-slug");
      // Only the cached-row SELECT should have hit the DB — no upsert path.
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it("denies idempotent replay when ownership mismatches the cached row", async () => {
      mockClaimIdempotencyKey.mockResolvedValueOnce(false);

      const cachedRowChain = mockChain({
        data: { slug: "cached-slug", owner_token_hash: "someone-else", user_id: null },
        error: null,
      });
      mockFrom.mockReturnValue(cachedRowChain);

      const req = makeRequest("POST", validPayload());
      const res = await POST(req);
      expect(res.status).toBe(403);
    });
  });

  describe("status regression guard", () => {
    it("returns 409 when trying to revert a sent quote back to draft", async () => {
      const { createHash } = await import("crypto");
      const tokenHash = createHash("sha256")
        .update("dt_test_token")
        .digest("hex");

      const selectChain = mockChain({
        data: { owner_token_hash: tokenHash, user_id: null, status: "sent" },
        error: null,
      });
      mockFrom.mockReturnValue(selectChain);

      const req = makeRequest("POST", validPayload({ status: "draft" }));
      const res = await POST(req);

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/sent/);
      expect(body.status).toBe("sent");
    });

    it("returns 409 when trying to revert an accepted quote back to draft", async () => {
      const { createHash } = await import("crypto");
      const tokenHash = createHash("sha256")
        .update("dt_test_token")
        .digest("hex");

      const selectChain = mockChain({
        data: { owner_token_hash: tokenHash, user_id: null, status: "accepted" },
        error: null,
      });
      mockFrom.mockReturnValue(selectChain);

      const req = makeRequest("POST", validPayload({ status: "draft" }));
      const res = await POST(req);

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.status).toBe("accepted");
    });

    it("allows sent -> sent (idempotent re-send) and sent -> accepted", async () => {
      const { createHash } = await import("crypto");
      const tokenHash = createHash("sha256")
        .update("dt_test_token")
        .digest("hex");

      const selectChain = mockChain({
        data: { owner_token_hash: tokenHash, user_id: null, status: "sent" },
        error: null,
      });

      const upsertChain = {
        select: vi.fn().mockResolvedValue({
          data: [
            { id: "test-id-123", owner_token_hash: tokenHash, user_id: null },
          ],
          error: null,
        }),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
      };

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? selectChain : upsertChain;
      });

      const req = makeRequest("POST", validPayload({ status: "accepted" }));
      const res = await POST(req);

      expect(res.status).toBe(200);
    });
  });
});

describe("DELETE /api/quotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when id is missing", async () => {
    const req = makeRequest("DELETE", { token: "t" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when token is missing", async () => {
    const req = makeRequest("DELETE", { id: "x" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when quote does not exist", async () => {
    const selectChain = mockChain({ data: null, error: null });
    mockFrom.mockReturnValue(selectChain);

    const req = makeRequest("DELETE", { id: "missing", token: "t" });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("returns 403 when token does not match", async () => {
    const selectChain = mockChain({
      data: { owner_token_hash: "wrong-hash" },
      error: null,
    });
    mockFrom.mockReturnValue(selectChain);

    const req = makeRequest("DELETE", { id: "q1", token: "t" });
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("deletes quote with matching token", async () => {
    const { createHash } = await import("crypto");
    const tokenHash = createHash("sha256").update("dt_test_token").digest("hex");

    const selectChain = mockChain({
      data: { owner_token_hash: tokenHash },
      error: null,
    });

    // delete().eq().select() chain: select() must resolve with the deleted rows
    const deleteChain = {
      select: vi.fn().mockResolvedValue({ data: [{ id: "q1" }], error: null }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return selectChain;
      return deleteChain;
    });

    const req = makeRequest("DELETE", { id: "q1", token: "dt_test_token" });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 when delete affects 0 rows (silent permission failure)", async () => {
    const { createHash } = await import("crypto");
    const tokenHash = createHash("sha256").update("dt_test_token").digest("hex");

    const selectChain = mockChain({
      data: { owner_token_hash: tokenHash },
      error: null,
    });

    // Simulate Supabase silent failure: no error, but 0 rows deleted
    const deleteChain = {
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return selectChain;
      return deleteChain;
    });

    const req = makeRequest("DELETE", { id: "q1", token: "dt_test_token" });
    const res = await DELETE(req);
    expect(res.status).toBe(500);
  });

  it.each(["sent", "accepted"] as const)(
    "returns 403 when status is %s (protected)",
    async (status) => {
      const { createHash } = await import("crypto");
      const tokenHash = createHash("sha256")
        .update("dt_test_token")
        .digest("hex");

      const selectChain = mockChain({
        data: { owner_token_hash: tokenHash, user_id: null, status },
        error: null,
      });
      mockFrom.mockReturnValue(selectChain);

      const req = makeRequest("DELETE", { id: "q1", token: "dt_test_token" });
      const res = await DELETE(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.status).toBe(status);
    }
  );

  it("returns 500 on delete error", async () => {
    const { createHash } = await import("crypto");
    const tokenHash = createHash("sha256").update("dt_test_token").digest("hex");

    const selectChain = mockChain({
      data: { owner_token_hash: tokenHash },
      error: null,
    });

    // delete().eq().select() chain: select() resolves with a DB error
    const deleteChain = {
      select: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return selectChain;
      return deleteChain;
    });

    const req = makeRequest("DELETE", { id: "q1", token: "dt_test_token" });
    const res = await DELETE(req);
    expect(res.status).toBe(500);
  });
});
