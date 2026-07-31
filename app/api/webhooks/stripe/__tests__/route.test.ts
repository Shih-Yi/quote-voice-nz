import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mock Stripe signature verification ---
const mockConstructEvent = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: { webhooks: { constructEvent: (...a: unknown[]) => mockConstructEvent(...a) } },
}));

// --- Mock subscription persistence ---
const mockUpsertSubscription = vi.fn().mockResolvedValue({ error: null });
const mockClaimStripeEvent = vi.fn().mockResolvedValue(true);
const mockReleaseStripeEvent = vi.fn().mockResolvedValue(undefined);
const mockGetLastStripeEventAt = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/supabase/subscription", () => ({
  upsertSubscription: (...a: unknown[]) => mockUpsertSubscription(...a),
  claimStripeEvent: (...a: unknown[]) => mockClaimStripeEvent(...a),
  releaseStripeEvent: (...a: unknown[]) => mockReleaseStripeEvent(...a),
  getLastStripeEventAt: (...a: unknown[]) => mockGetLastStripeEventAt(...a),
}));

// The route captures STRIPE_WEBHOOK_SECRET at module scope, so it has to be
// present before the import — stubbing it in beforeEach would be too late.
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_monthly";

const { POST } = await import("../route");

const JAN_10 = Math.floor(new Date("2026-01-10T00:00:00Z").getTime() / 1000);
const JAN_20 = Math.floor(new Date("2026-01-20T00:00:00Z").getTime() / 1000);

function subscriptionEvent(
  type: string,
  { created, status }: { created: number; status: string }
) {
  return {
    id: `evt_${type}_${created}`,
    type,
    created,
    data: {
      object: {
        id: "sub_1",
        status,
        customer: "cus_1",
        metadata: { userId: "user-1" },
        trial_end: null,
        current_period_end: JAN_20,
        items: {
          data: [{ price: { id: "price_pro_monthly", recurring: { interval: "month" } } }],
        },
      },
    },
  };
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: "{}",
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClaimStripeEvent.mockResolvedValue(true);
    mockGetLastStripeEventAt.mockResolvedValue(null);
    mockUpsertSubscription.mockResolvedValue({ error: null });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects an unverifiable signature without touching state", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(400);
    expect(mockClaimStripeEvent).not.toHaveBeenCalled();
    expect(mockUpsertSubscription).not.toHaveBeenCalled();
  });

  it("applies a first-delivery subscription event", async () => {
    mockConstructEvent.mockReturnValue(
      subscriptionEvent("customer.subscription.updated", {
        created: JAN_20,
        status: "active",
      })
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mockUpsertSubscription).toHaveBeenCalledTimes(1);
    expect(mockUpsertSubscription.mock.calls[0][0]).toMatchObject({
      userId: "user-1",
      tier: "pro",
      status: "active",
    });
  });

  // Stripe retries on any non-2xx and can redeliver after success.
  it("acknowledges a redelivery without applying it again", async () => {
    mockClaimStripeEvent.mockResolvedValue(false);
    mockConstructEvent.mockReturnValue(
      subscriptionEvent("customer.subscription.updated", {
        created: JAN_20,
        status: "active",
      })
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect((await res.json()).duplicate).toBe(true);
    expect(mockUpsertSubscription).not.toHaveBeenCalled();
  });

  // Stripe does not guarantee ordering. Before this, a stale "active" landing
  // after a cancellation restored the paid tier.
  it("ignores an event older than the state already stored", async () => {
    mockGetLastStripeEventAt.mockResolvedValue("2026-01-20T00:00:00.000Z");
    mockConstructEvent.mockReturnValue(
      subscriptionEvent("customer.subscription.updated", {
        created: JAN_10,
        status: "active",
      })
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(mockUpsertSubscription).not.toHaveBeenCalled();
  });

  it("does not let a late activate undo a cancellation", async () => {
    // The cancel is processed first and records its timestamp.
    mockConstructEvent.mockReturnValue(
      subscriptionEvent("customer.subscription.deleted", {
        created: JAN_20,
        status: "canceled",
      })
    );
    await POST(makeRequest());
    expect(mockUpsertSubscription.mock.calls[0][0]).toMatchObject({
      tier: "free",
      status: "cancelled",
    });

    // Now the older "active" update turns up.
    mockUpsertSubscription.mockClear();
    mockGetLastStripeEventAt.mockResolvedValue("2026-01-20T00:00:00.000Z");
    mockConstructEvent.mockReturnValue(
      subscriptionEvent("customer.subscription.updated", {
        created: JAN_10,
        status: "active",
      })
    );

    await POST(makeRequest());
    expect(mockUpsertSubscription).not.toHaveBeenCalled();
  });

  it("stamps the event time so later deliveries can be ordered against it", async () => {
    mockConstructEvent.mockReturnValue(
      subscriptionEvent("customer.subscription.updated", {
        created: JAN_20,
        status: "active",
      })
    );

    await POST(makeRequest());

    expect(mockUpsertSubscription.mock.calls[0][0].lastStripeEventAt).toBe(
      "2026-01-20T00:00:00.000Z"
    );
  });

  // The id is claimed before the work is done, so a failure has to give it
  // back or Stripe's retry is discarded as a duplicate and the billing change
  // is lost for good.
  it("releases the claimed event id when the handler throws", async () => {
    mockConstructEvent.mockReturnValue(
      subscriptionEvent("customer.subscription.updated", {
        created: JAN_20,
        status: "active",
      })
    );
    mockUpsertSubscription.mockRejectedValue(new Error("database down"));

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    expect(mockReleaseStripeEvent).toHaveBeenCalledWith(
      `evt_customer.subscription.updated_${JAN_20}`
    );
  });
});
