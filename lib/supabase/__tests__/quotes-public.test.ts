import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRpc = vi.fn();

vi.mock("../client", () => ({
  getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }),
}));

import { getQuoteBySlugFromSupabase } from "../quotes";

// Shape of a row as returned by api.get_quote_by_slug after migration 018.
function rpcRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "quote-1",
    slug: "abc12345",
    user_id: "user-1",
    customer_name: "Jane Homeowner",
    customer_phone: null,
    customer_email: null,
    customer_address: null,
    provider_details: null,
    items: [],
    notes: null,
    gst_inclusive: false,
    items_sum: 100,
    subtotal: 100,
    gst: 15,
    total: 115,
    status: "sent",
    parent_id: null,
    version: 1,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    owner_business_name: "Kiwi Plumbing Ltd",
    owner_phone: "021 555 0100",
    owner_email: "tradie@example.co.nz",
    owner_address: "12 Colombo St, Christchurch",
    owner_subscription_tier: "pro",
    ...overrides,
  };
}

describe("getQuoteBySlugFromSupabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never exposes the owner's bank account on a public quote", async () => {
    // Migration 018 dropped the column; even if a stale deployment still
    // returned it, the mapper must not surface it.
    mockRpc.mockResolvedValue({
      data: [rpcRow({ owner_bank_account: "12-3456-7890123-00" })],
      error: null,
    });

    const quote = await getQuoteBySlugFromSupabase("abc12345");

    expect(quote?.ownerProfile).toBeDefined();
    expect(quote?.ownerProfile?.businessName).toBe("Kiwi Plumbing Ltd");
    expect(quote?.ownerProfile?.bankAccount).toBeUndefined();
    expect(JSON.stringify(quote)).not.toContain("12-3456-7890123-00");
  });

  it("carries the owner's tier through for the accept-button decision", async () => {
    mockRpc.mockResolvedValue({ data: [rpcRow()], error: null });
    const quote = await getQuoteBySlugFromSupabase("abc12345");

    expect(quote?.ownerTier).toBe("pro");
    expect(quote?.showWatermark).toBe(false);
  });

  it("treats a free-tier owner as free and watermarked", async () => {
    mockRpc.mockResolvedValue({
      data: [rpcRow({ owner_subscription_tier: "free" })],
      error: null,
    });
    const quote = await getQuoteBySlugFromSupabase("abc12345");

    expect(quote?.ownerTier).toBe("free");
    expect(quote?.showWatermark).toBe(true);
  });

  it("falls back to free for an anonymous quote", async () => {
    mockRpc.mockResolvedValue({
      data: [rpcRow({ user_id: null, owner_subscription_tier: null })],
      error: null,
    });
    const quote = await getQuoteBySlugFromSupabase("abc12345");

    expect(quote?.ownerTier).toBe("free");
    expect(quote?.showWatermark).toBe(true);
  });

  it("never fails open to a paid tier on an unrecognised value", async () => {
    mockRpc.mockResolvedValue({
      data: [rpcRow({ owner_subscription_tier: "enterprise" })],
      error: null,
    });
    const quote = await getQuoteBySlugFromSupabase("abc12345");

    expect(quote?.ownerTier).toBe("free");
  });

  it("still builds an owner profile when only contact fields are present", async () => {
    mockRpc.mockResolvedValue({
      data: [
        rpcRow({
          owner_business_name: null,
          owner_email: null,
          owner_address: null,
          owner_phone: "021 555 0100",
        }),
      ],
      error: null,
    });
    const quote = await getQuoteBySlugFromSupabase("abc12345");

    expect(quote?.ownerProfile?.phone).toBe("021 555 0100");
  });
});
