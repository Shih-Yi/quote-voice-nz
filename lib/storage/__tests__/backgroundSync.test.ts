import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSyncPendingQuotes = vi.fn();
const mockSyncPendingDeletions = vi.fn();

vi.mock("../quotes", () => ({
  syncPendingQuotes: () => mockSyncPendingQuotes(),
  syncPendingDeletions: () => mockSyncPendingDeletions(),
}));

const { flushQuoteQueues, flushChangedAnything } = await import(
  "../backgroundSync"
);

const emptyQuotes = { synced: 0, failed: 0, skipped: 0, gaveUp: 0 };
const emptyDeletions = { deleted: 0, failed: 0, skipped: 0, gaveUp: 0 };

describe("flushQuoteQueues", () => {
  beforeEach(() => {
    mockSyncPendingQuotes.mockReset().mockResolvedValue(emptyQuotes);
    mockSyncPendingDeletions.mockReset().mockResolvedValue(emptyDeletions);
  });

  it("runs deletions before quote syncs", async () => {
    const order: string[] = [];
    mockSyncPendingDeletions.mockImplementation(async () => {
      order.push("deletions");
      return emptyDeletions;
    });
    mockSyncPendingQuotes.mockImplementation(async () => {
      order.push("quotes");
      return emptyQuotes;
    });

    const result = await flushQuoteQueues();

    expect(order).toEqual(["deletions", "quotes"]);
    expect(result).toEqual({ quotes: emptyQuotes, deletions: emptyDeletions });
  });

  it("returns the per-queue results", async () => {
    mockSyncPendingQuotes.mockResolvedValue({ ...emptyQuotes, synced: 2 });
    mockSyncPendingDeletions.mockResolvedValue({ ...emptyDeletions, deleted: 1 });

    const result = await flushQuoteQueues();

    expect(result?.quotes.synced).toBe(2);
    expect(result?.deletions.deleted).toBe(1);
  });
});

describe("flushChangedAnything", () => {
  it("is false for null (lock held by another tab)", () => {
    expect(flushChangedAnything(null)).toBe(false);
  });

  it("is false when nothing was pushed", () => {
    expect(
      flushChangedAnything({ quotes: emptyQuotes, deletions: emptyDeletions })
    ).toBe(false);
  });

  it("is true when a quote synced or a deletion completed", () => {
    expect(
      flushChangedAnything({
        quotes: { ...emptyQuotes, synced: 1 },
        deletions: emptyDeletions,
      })
    ).toBe(true);
    expect(
      flushChangedAnything({
        quotes: emptyQuotes,
        deletions: { ...emptyDeletions, deleted: 1 },
      })
    ).toBe(true);
  });
});
