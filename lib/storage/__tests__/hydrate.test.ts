import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Quote } from "@/types/quote";

const mockStore = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: vi.fn((key: string) => Promise.resolve(mockStore.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
}));

const mockFetchUserQuotesFromCloud = vi.fn();

vi.mock("@/lib/supabase/quotes-api", () => ({
  fetchUserQuotesFromCloud: (...args: unknown[]) =>
    mockFetchUserQuotesFromCloud(...args),
}));

const mockGetSyncQueue = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/storage/quotes", () => ({
  getSyncQueue: () => mockGetSyncQueue(),
}));

const { hydrateUserQuotesFromCloud } = await import("../hydrate");

const QUOTES_KEY = "ksq_quotes";

function makeQuote(partial: Partial<Quote> & { id: string }): Quote {
  return {
    slug: `slug-${partial.id}`,
    customerName: "Customer",
    items: [],
    gstInclusive: false,
    subtotal: 0,
    gst: 0,
    total: 0,
    status: "draft",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("hydrateUserQuotesFromCloud", () => {
  beforeEach(() => {
    mockStore.clear();
    mockFetchUserQuotesFromCloud.mockReset();
    mockGetSyncQueue.mockReset();
    mockGetSyncQueue.mockResolvedValue([]);
  });

  it("adds cloud-only quotes to local IndexedDB", async () => {
    const cloud = makeQuote({ id: "q1", customerName: "Cloud Only" });
    mockFetchUserQuotesFromCloud.mockResolvedValueOnce({
      quotes: [cloud],
      error: null,
    });

    const result = await hydrateUserQuotesFromCloud();

    expect(result).toEqual({ added: 1, updated: 0, kept: 0, error: null });
    const stored = mockStore.get(QUOTES_KEY) as Quote[];
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("q1");
  });

  it("overwrites local with cloud when cloud is newer", async () => {
    const local = makeQuote({
      id: "q1",
      customerName: "Local Stale",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const cloud = makeQuote({
      id: "q1",
      customerName: "Cloud Fresh",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
    mockStore.set(QUOTES_KEY, [local]);
    mockFetchUserQuotesFromCloud.mockResolvedValueOnce({
      quotes: [cloud],
      error: null,
    });

    const result = await hydrateUserQuotesFromCloud();

    expect(result.updated).toBe(1);
    const stored = mockStore.get(QUOTES_KEY) as Quote[];
    expect(stored[0].customerName).toBe("Cloud Fresh");
  });

  it("preserves local-only fields when cloud wins (attachments never sync)", async () => {
    const local = makeQuote({
      id: "q1",
      customerName: "Local Stale",
      updatedAt: "2026-01-01T00:00:00.000Z",
      attachments: [
        {
          id: "att-1",
          name: "site-photo.jpg",
          dataUrl: "data:image/jpeg;base64,abc",
          mimeType: "image/jpeg",
          size: 1234,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      signatureDataUrl: "data:image/png;base64,sig",
      ownerToken: "secret-token",
    });
    const cloud = makeQuote({
      id: "q1",
      customerName: "Cloud Fresh",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
    mockStore.set(QUOTES_KEY, [local]);
    mockFetchUserQuotesFromCloud.mockResolvedValueOnce({
      quotes: [cloud],
      error: null,
    });

    const result = await hydrateUserQuotesFromCloud();

    expect(result.updated).toBe(1);
    const stored = mockStore.get(QUOTES_KEY) as Quote[];
    expect(stored[0].customerName).toBe("Cloud Fresh");
    expect(stored[0].attachments).toHaveLength(1);
    expect(stored[0].attachments?.[0].id).toBe("att-1");
    expect(stored[0].signatureDataUrl).toBe("data:image/png;base64,sig");
    expect(stored[0].ownerToken).toBe("secret-token");
  });

  it("keeps local when local is newer (offline edits not yet synced)", async () => {
    const local = makeQuote({
      id: "q1",
      customerName: "Local Fresh",
      updatedAt: "2026-03-01T00:00:00.000Z",
    });
    const cloud = makeQuote({
      id: "q1",
      customerName: "Cloud Stale",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
    mockStore.set(QUOTES_KEY, [local]);
    mockFetchUserQuotesFromCloud.mockResolvedValueOnce({
      quotes: [cloud],
      error: null,
    });

    const result = await hydrateUserQuotesFromCloud();

    expect(result.kept).toBe(1);
    expect(result.updated).toBe(0);
    const stored = mockStore.get(QUOTES_KEY) as Quote[];
    expect(stored[0].customerName).toBe("Local Fresh");
  });

  it("does not overwrite tombstoned local rows (pending delete wins)", async () => {
    const local = makeQuote({
      id: "q1",
      customerName: "Tombstoned",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: "2026-02-15T00:00:00.000Z",
    });
    const cloud = makeQuote({
      id: "q1",
      customerName: "Resurrected From Cloud",
      updatedAt: "2026-03-01T00:00:00.000Z",
    });
    mockStore.set(QUOTES_KEY, [local]);
    mockFetchUserQuotesFromCloud.mockResolvedValueOnce({
      quotes: [cloud],
      error: null,
    });

    const result = await hydrateUserQuotesFromCloud();

    expect(result.kept).toBe(1);
    expect(result.updated).toBe(0);
    const stored = mockStore.get(QUOTES_KEY) as Quote[];
    expect(stored[0].deletedAt).toBeDefined();
    expect(stored[0].customerName).toBe("Tombstoned");
  });

  it("preserves local-only quotes not present in cloud", async () => {
    const localOnly = makeQuote({ id: "local-only", customerName: "Local" });
    const cloud = makeQuote({ id: "cloud-only", customerName: "Cloud" });
    mockStore.set(QUOTES_KEY, [localOnly]);
    mockFetchUserQuotesFromCloud.mockResolvedValueOnce({
      quotes: [cloud],
      error: null,
    });

    await hydrateUserQuotesFromCloud();

    const stored = mockStore.get(QUOTES_KEY) as Quote[];
    const ids = stored.map((q) => q.id).sort();
    expect(ids).toEqual(["cloud-only", "local-only"]);
  });

  it("never overwrites a local row that's pending sync, even when cloud is newer", async () => {
    const local = makeQuote({
      id: "q1",
      customerName: "Local Offline Edit",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const cloud = makeQuote({
      id: "q1",
      customerName: "Cloud From Other Device",
      updatedAt: "2026-03-01T00:00:00.000Z",
    });
    mockStore.set(QUOTES_KEY, [local]);
    mockGetSyncQueue.mockResolvedValueOnce(["q1"]);
    mockFetchUserQuotesFromCloud.mockResolvedValueOnce({
      quotes: [cloud],
      error: null,
    });

    const result = await hydrateUserQuotesFromCloud();

    expect(result.kept).toBe(1);
    expect(result.updated).toBe(0);
    const stored = mockStore.get(QUOTES_KEY) as Quote[] | undefined;
    // No write happened because nothing actually changed.
    expect(stored).toEqual([local]);
  });

  it("skips IndexedDB write when merge is a no-op", async () => {
    const local = makeQuote({
      id: "q1",
      updatedAt: "2026-03-01T00:00:00.000Z",
    });
    const cloud = makeQuote({
      id: "q1",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mockStore.set(QUOTES_KEY, [local]);
    mockFetchUserQuotesFromCloud.mockResolvedValueOnce({
      quotes: [cloud],
      error: null,
    });
    const idb = await import("idb-keyval");
    const setSpy = vi.mocked(idb.set);
    setSpy.mockClear();

    const result = await hydrateUserQuotesFromCloud();

    expect(result).toMatchObject({ added: 0, updated: 0, kept: 1 });
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("returns error from fetch and does not touch local storage", async () => {
    mockStore.set(QUOTES_KEY, []);
    mockFetchUserQuotesFromCloud.mockResolvedValueOnce({
      quotes: [],
      error: "Unauthorized",
    });

    const result = await hydrateUserQuotesFromCloud();

    expect(result).toEqual({
      added: 0,
      updated: 0,
      kept: 0,
      error: "Unauthorized",
    });
  });
});
