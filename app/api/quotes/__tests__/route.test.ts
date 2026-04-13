import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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

  it("inserts a new quote when it does not exist", async () => {
    const selectChain = mockChain({ data: null, error: { code: "PGRST116" } });

    // upsert().select() chain: select must be the terminal promise
    const upsertChain = {
      select: vi.fn().mockResolvedValue({ data: [{ id: "test-id-123" }], error: null }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
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

  it("updates an existing quote with matching token", async () => {
    const { createHash } = await import("crypto");
    const tokenHash = createHash("sha256").update("dt_test_token").digest("hex");

    const selectChain = mockChain({
      data: { owner_token_hash: tokenHash },
      error: null,
    });

    // upsert().select() — select must be the terminal promise
    const upsertChain = {
      select: vi.fn().mockResolvedValue({ data: [{ id: "test-id-123" }], error: null }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
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
    const selectChain = mockChain({ data: null, error: { code: "PGRST116" } });

    const upsertChain = {
      select: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
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
