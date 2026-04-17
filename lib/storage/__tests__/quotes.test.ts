import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Quote } from "@/types/quote";

// --- In-memory mock for idb-keyval ---
const mockStore = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: vi.fn((key: string) => Promise.resolve(mockStore.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
}));

// --- Mock Supabase sync functions ---
const mockSyncQuoteToSupabase = vi.fn().mockResolvedValue({ success: true });
const mockDeleteQuoteFromSupabase = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/lib/supabase/quotes-api", () => ({
  syncQuoteToSupabase: (...args: unknown[]) => mockSyncQuoteToSupabase(...args),
  deleteQuoteFromSupabase: (...args: unknown[]) => mockDeleteQuoteFromSupabase(...args),
}));

vi.mock("@/lib/supabase/quotes", () => ({
  getQuoteBySlugFromSupabase: vi.fn().mockResolvedValue(null),
  getQuoteByIdFromSupabase: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/storage/deviceToken", () => ({
  getDeviceToken: vi.fn().mockResolvedValue("dt_test_device_token"),
}));

vi.mock("@/lib/utils/swCache", () => ({
  preCacheQuotePage: vi.fn(),
}));

vi.mock("@/lib/utils/auditLog", () => ({
  logAudit: vi.fn(),
}));

const {
  getAllQuotes,
  getQuoteById,
  saveQuote,
  updateQuote,
  deleteQuote,
  getRecentQuotes,
  markQuoteAsSent,
  duplicateQuote,
  getSyncQueue,
  syncPendingQuotes,
  generateSlug,
  countLocalQuotes,
} = await import("../quotes");

// --- Test helpers ---
function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: crypto.randomUUID(),
    customerName: "Test Customer",
    items: [
      { id: "item-1", description: "General Labour", quantity: 2, unitPrice: 85, total: 170 },
    ],
    gstInclusive: false,
    subtotal: 170,
    gst: 25.5,
    total: 195.5,
    status: "draft",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("quotes storage", () => {
  beforeEach(() => {
    mockStore.clear();
    mockSyncQuoteToSupabase.mockReset().mockResolvedValue({ success: true });
    mockDeleteQuoteFromSupabase.mockReset().mockResolvedValue({ success: true });
  });

  // ─── READ ─────────────────────────────────────────────

  describe("getAllQuotes", () => {
    it("returns empty array when no quotes exist", async () => {
      expect(await getAllQuotes()).toEqual([]);
    });

    it("returns stored quotes", async () => {
      const quotes = [makeQuote({ id: "q1" }), makeQuote({ id: "q2" })];
      mockStore.set("ksq_quotes", quotes);

      const result = await getAllQuotes();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("q1");
    });
  });

  describe("getQuoteById", () => {
    it("returns undefined when quote not found", async () => {
      expect(await getQuoteById("nonexistent")).toBeUndefined();
    });

    it("returns the correct quote", async () => {
      mockStore.set("ksq_quotes", [makeQuote({ id: "q1" }), makeQuote({ id: "q2" })]);

      const result = await getQuoteById("q2");
      expect(result?.id).toBe("q2");
    });
  });

  describe("getRecentQuotes", () => {
    it("returns quotes sorted by updatedAt descending", async () => {
      mockStore.set("ksq_quotes", [
        makeQuote({ id: "old", updatedAt: "2026-01-01T00:00:00Z" }),
        makeQuote({ id: "new", updatedAt: "2026-03-01T00:00:00Z" }),
        makeQuote({ id: "mid", updatedAt: "2026-02-01T00:00:00Z" }),
      ]);

      const result = await getRecentQuotes(2);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("new");
      expect(result[1].id).toBe("mid");
    });

    it("defaults to 10 items", async () => {
      const quotes = Array.from({ length: 15 }, (_, i) =>
        makeQuote({ id: `q${i}`, updatedAt: `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z` })
      );
      mockStore.set("ksq_quotes", quotes);

      const result = await getRecentQuotes();
      expect(result).toHaveLength(10);
    });
  });

  describe("countLocalQuotes", () => {
    it("returns 0 when no quotes", async () => {
      expect(await countLocalQuotes()).toBe(0);
    });

    it("returns correct count", async () => {
      mockStore.set("ksq_quotes", [makeQuote(), makeQuote()]);
      expect(await countLocalQuotes()).toBe(2);
    });
  });

  // ─── CREATE ───────────────────────────────────────────

  describe("saveQuote", () => {
    it("saves a new quote to local storage", async () => {
      const quote = makeQuote({ id: "new-q" });
      await saveQuote(quote);

      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe("new-q");
    });

    it("sets updatedAt on save", async () => {
      const quote = makeQuote({ updatedAt: "2020-01-01T00:00:00Z" });
      await saveQuote(quote);

      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored[0].updatedAt).not.toBe("2020-01-01T00:00:00Z");
    });

    it("syncs to Supabase by default", async () => {
      await saveQuote(makeQuote());

      expect(mockSyncQuoteToSupabase).toHaveBeenCalledOnce();
    });

    it("returns synced: true on successful cloud sync", async () => {
      const result = await saveQuote(makeQuote());
      expect(result.synced).toBe(true);
    });

    it("skips cloud sync when localOnly is true", async () => {
      const result = await saveQuote(makeQuote(), { localOnly: true });

      expect(mockSyncQuoteToSupabase).not.toHaveBeenCalled();
      expect(result.synced).toBe(false);
    });

    it("adds to sync queue when localOnly", async () => {
      const quote = makeQuote({ id: "local-only-q" });
      await saveQuote(quote, { localOnly: true });

      const queue = mockStore.get("ksq_sync_queue") as string[];
      expect(queue).toContain("local-only-q");
    });

    it("adds to sync queue when cloud sync fails", async () => {
      mockSyncQuoteToSupabase.mockResolvedValue({ success: false, error: "Network error" });

      const quote = makeQuote({ id: "fail-q" });
      await saveQuote(quote);

      const queue = mockStore.get("ksq_sync_queue") as string[];
      expect(queue).toContain("fail-q");
    });

    it("removes from sync queue on successful sync", async () => {
      // Pre-fill sync queue
      mockStore.set("ksq_sync_queue", ["q1"]);

      await saveQuote(makeQuote({ id: "q1" }));

      const queue = mockStore.get("ksq_sync_queue") as string[];
      expect(queue).not.toContain("q1");
    });

    it("upserts by ID — does not create duplicates", async () => {
      const quote = makeQuote({ id: "dup-q" });
      mockStore.set("ksq_quotes", [quote]);

      await saveQuote({ ...quote, customerName: "Updated Name" });

      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored).toHaveLength(1);
      expect(stored[0].customerName).toBe("Updated Name");
    });
  });

  // ─── UPDATE ───────────────────────────────────────────

  describe("updateQuote", () => {
    it("updates an existing quote locally", async () => {
      const quote = makeQuote({ id: "u1" });
      mockStore.set("ksq_quotes", [quote]);

      await updateQuote({ ...quote, customerName: "New Name" });

      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored[0].customerName).toBe("New Name");
    });

    it("rejects updates to non-draft quotes", async () => {
      const quote = makeQuote({ id: "sent-q", status: "sent" });
      const result = await updateQuote(quote);

      expect(result.error).toBe("Cannot edit sent quotes. Please duplicate instead.");
      expect(result.synced).toBe(false);
    });

    it("syncs to Supabase after local save", async () => {
      const quote = makeQuote({ id: "sync-q" });
      mockStore.set("ksq_quotes", [quote]);

      await updateQuote({ ...quote, customerName: "Updated" });

      expect(mockSyncQuoteToSupabase).toHaveBeenCalledOnce();
    });

    it("returns synced: true on successful cloud sync", async () => {
      const quote = makeQuote({ id: "ok-q" });
      mockStore.set("ksq_quotes", [quote]);

      const result = await updateQuote(quote);
      expect(result.synced).toBe(true);
    });

    it("returns syncError when cloud sync fails", async () => {
      mockSyncQuoteToSupabase.mockResolvedValue({ success: false, error: "DB timeout" });

      const quote = makeQuote({ id: "fail-q" });
      mockStore.set("ksq_quotes", [quote]);

      const result = await updateQuote(quote);
      expect(result.synced).toBe(false);
      expect(result.syncError).toBe("DB timeout");
      expect(result.error).toBeUndefined();
    });

    it("adds to sync queue when cloud sync fails", async () => {
      mockSyncQuoteToSupabase.mockResolvedValue({ success: false, error: "Network" });

      const quote = makeQuote({ id: "queue-q" });
      mockStore.set("ksq_quotes", [quote]);

      await updateQuote(quote);

      const queue = mockStore.get("ksq_sync_queue") as string[];
      expect(queue).toContain("queue-q");
    });

    it("updates updatedAt timestamp", async () => {
      const quote = makeQuote({ id: "ts-q", updatedAt: "2020-01-01T00:00:00Z" });
      mockStore.set("ksq_quotes", [quote]);

      await updateQuote(quote);

      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored[0].updatedAt).not.toBe("2020-01-01T00:00:00Z");
    });
  });

  // ─── DELETE ───────────────────────────────────────────

  describe("deleteQuote", () => {
    it("removes quote from local storage", async () => {
      mockStore.set("ksq_quotes", [makeQuote({ id: "del-q" })]);

      await deleteQuote("del-q");

      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored).toHaveLength(0);
    });

    it("calls deleteQuoteFromSupabase", async () => {
      mockStore.set("ksq_quotes", [makeQuote({ id: "del-q" })]);

      await deleteQuote("del-q");

      expect(mockDeleteQuoteFromSupabase).toHaveBeenCalledWith("del-q", "dt_test_device_token");
    });

    it("removes from sync queue", async () => {
      mockStore.set("ksq_quotes", [makeQuote({ id: "del-q" })]);
      mockStore.set("ksq_sync_queue", ["del-q", "other-q"]);

      await deleteQuote("del-q");

      const queue = mockStore.get("ksq_sync_queue") as string[];
      expect(queue).not.toContain("del-q");
      expect(queue).toContain("other-q");
    });

    it("returns cloudDeleted: false when Supabase delete fails", async () => {
      mockDeleteQuoteFromSupabase.mockResolvedValue({ success: false, error: "Not found" });
      mockStore.set("ksq_quotes", [makeQuote({ id: "del-q" })]);

      const result = await deleteQuote("del-q");
      expect(result.cloudDeleted).toBe(false);
      expect(result.error).toBe("Not found");
    });

    it("adds to delete queue when Supabase delete fails", async () => {
      mockDeleteQuoteFromSupabase.mockResolvedValue({ success: false, error: "Not found" });
      mockStore.set("ksq_quotes", [makeQuote({ id: "del-q" })]);

      await deleteQuote("del-q");

      const deleteQueue = mockStore.get("ksq_delete_queue") as string[];
      expect(deleteQueue).toContain("del-q");
    });

    // ─── Tombstone behaviour ──────────────────────────

    it("keeps a tombstone (not a physical purge) when cloud delete fails", async () => {
      mockDeleteQuoteFromSupabase.mockResolvedValue({ success: false, error: "Network" });
      mockStore.set("ksq_quotes", [makeQuote({ id: "del-q" })]);

      await deleteQuote("del-q");

      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe("del-q");
      expect(stored[0].deletedAt).toBeTruthy();
    });

    it("physically purges from local storage on cloud-delete success", async () => {
      mockDeleteQuoteFromSupabase.mockResolvedValue({ success: true });
      mockStore.set("ksq_quotes", [makeQuote({ id: "del-q" })]);

      await deleteQuote("del-q");

      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored).toHaveLength(0);
    });

    it("hides tombstoned quotes from getAllQuotes and getQuoteById", async () => {
      mockDeleteQuoteFromSupabase.mockResolvedValue({ success: false, error: "Offline" });
      mockStore.set("ksq_quotes", [
        makeQuote({ id: "keep-q" }),
        makeQuote({ id: "del-q" }),
      ]);

      await deleteQuote("del-q");

      const visible = await getAllQuotes();
      expect(visible.map((q) => q.id)).toEqual(["keep-q"]);
      expect(await getQuoteById("del-q")).toBeUndefined();
    });

    it("fast-path: purges locally without calling Supabase for never-synced quotes", async () => {
      mockStore.set("ksq_quotes", [makeQuote({ id: "offline-q" })]);
      mockStore.set("ksq_sync_queue", ["offline-q"]);

      const result = await deleteQuote("offline-q");

      expect(mockDeleteQuoteFromSupabase).not.toHaveBeenCalled();
      expect(result.cloudDeleted).toBe(true);
      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored).toHaveLength(0);
      const syncQueue = mockStore.get("ksq_sync_queue") as string[];
      expect(syncQueue).not.toContain("offline-q");
    });

    it("is idempotent — deleting a non-existent quote returns success", async () => {
      const result = await deleteQuote("never-existed");

      expect(result.cloudDeleted).toBe(true);
      expect(mockDeleteQuoteFromSupabase).not.toHaveBeenCalled();
    });
  });

  // ─── SYNC + DELETE QUEUE INTERACTION ──────────────────

  describe("syncPendingDeletions with tombstones", () => {
    it("physically purges tombstoned quote after cloud-delete success", async () => {
      mockDeleteQuoteFromSupabase
        .mockResolvedValueOnce({ success: false, error: "Offline" })  // initial delete
        .mockResolvedValueOnce({ success: true });                      // retry
      mockStore.set("ksq_quotes", [makeQuote({ id: "retry-q" })]);

      await deleteQuote("retry-q");
      // After failed delete: tombstone remains, queued for retry
      expect((mockStore.get("ksq_quotes") as Quote[])).toHaveLength(1);

      const { syncPendingDeletions } = await import("../quotes");
      const result = await syncPendingDeletions();

      expect(result.deleted).toBe(1);
      expect((mockStore.get("ksq_quotes") as Quote[])).toHaveLength(0);
      expect((mockStore.get("ksq_delete_queue") as string[]) ?? []).not.toContain("retry-q");
    });
  });

  describe("syncPendingQuotes skips tombstoned quotes", () => {
    it("removes tombstoned quote from sync queue without calling Supabase", async () => {
      // Quote is queued for sync AND tombstoned (edge case: user deleted before sync finished)
      const tombstoned = makeQuote({ id: "zombie-q", deletedAt: "2026-04-17T00:00:00Z" });
      mockStore.set("ksq_quotes", [tombstoned]);
      mockStore.set("ksq_sync_queue", ["zombie-q"]);

      const result = await syncPendingQuotes();

      expect(mockSyncQuoteToSupabase).not.toHaveBeenCalled();
      expect(result.synced).toBe(0);
      expect((mockStore.get("ksq_sync_queue") as string[])).not.toContain("zombie-q");
    });
  });

  // ─── MARK AS SENT ────────────────────────────────────

  describe("markQuoteAsSent", () => {
    it("changes status to sent", async () => {
      mockStore.set("ksq_quotes", [makeQuote({ id: "send-q", slug: "abc123" })]);

      await markQuoteAsSent("send-q");

      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored[0].status).toBe("sent");
    });

    it("syncs to Supabase", async () => {
      mockStore.set("ksq_quotes", [makeQuote({ id: "send-q" })]);

      await markQuoteAsSent("send-q");

      expect(mockSyncQuoteToSupabase).toHaveBeenCalledOnce();
    });

    it("returns synced: false when quote not found", async () => {
      const result = await markQuoteAsSent("nonexistent");
      expect(result.synced).toBe(false);
    });
  });

  // ─── DUPLICATE ────────────────────────────────────────

  describe("duplicateQuote", () => {
    it("creates a new quote with new id", async () => {
      const original = makeQuote({ id: "orig", version: 1 });
      mockStore.set("ksq_quotes", [original]);

      const dup = await duplicateQuote("orig");

      expect(dup).not.toBeNull();
      expect(dup!.id).not.toBe("orig");
    });

    it("sets parentId to original id", async () => {
      const original = makeQuote({ id: "orig", version: 1 });
      mockStore.set("ksq_quotes", [original]);

      const dup = await duplicateQuote("orig");
      expect(dup!.parentId).toBe("orig");
    });

    it("increments version number", async () => {
      const original = makeQuote({ id: "orig", version: 2 });
      mockStore.set("ksq_quotes", [original]);

      const dup = await duplicateQuote("orig");
      expect(dup!.version).toBe(3);
    });

    it("sets status to draft", async () => {
      const original = makeQuote({ id: "orig", status: "sent", version: 1 });
      mockStore.set("ksq_quotes", [original]);

      const dup = await duplicateQuote("orig");
      expect(dup!.status).toBe("draft");
    });

    it("returns null for nonexistent quote", async () => {
      expect(await duplicateQuote("missing")).toBeNull();
    });

    it("chains parentId to root for nested duplicates", async () => {
      const root = makeQuote({ id: "root", version: 1 });
      const v2 = makeQuote({ id: "v2", parentId: "root", version: 2 });
      mockStore.set("ksq_quotes", [root, v2]);

      const v3 = await duplicateQuote("v2");
      expect(v3!.parentId).toBe("root"); // Points to root, not v2
    });
  });

  // ─── SYNC QUEUE ───────────────────────────────────────

  describe("sync queue", () => {
    it("getSyncQueue returns empty array by default", async () => {
      expect(await getSyncQueue()).toEqual([]);
    });

    it("getSyncQueue returns queued IDs", async () => {
      mockStore.set("ksq_sync_queue", ["q1", "q2"]);
      expect(await getSyncQueue()).toEqual(["q1", "q2"]);
    });
  });

  describe("syncPendingQuotes", () => {
    it("returns zeroes when queue is empty", async () => {
      const result = await syncPendingQuotes();
      expect(result).toEqual({ synced: 0, failed: 0 });
    });

    it("syncs queued quotes and removes from queue on success", async () => {
      const quote = makeQuote({ id: "pending-q" });
      mockStore.set("ksq_quotes", [quote]);
      mockStore.set("ksq_sync_queue", ["pending-q"]);

      const result = await syncPendingQuotes();

      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      const queue = mockStore.get("ksq_sync_queue") as string[];
      expect(queue).not.toContain("pending-q");
    });

    it("counts failed syncs", async () => {
      mockSyncQuoteToSupabase.mockResolvedValue({ success: false });

      const quote = makeQuote({ id: "fail-q" });
      mockStore.set("ksq_quotes", [quote]);
      mockStore.set("ksq_sync_queue", ["fail-q"]);

      const result = await syncPendingQuotes();
      expect(result.failed).toBe(1);
    });

    it("removes deleted quotes from queue silently", async () => {
      mockStore.set("ksq_quotes", []);
      mockStore.set("ksq_sync_queue", ["gone-q"]);

      const result = await syncPendingQuotes();

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
      const queue = mockStore.get("ksq_sync_queue") as string[];
      expect(queue).not.toContain("gone-q");
    });
  });

  // ─── GENERATE SLUG ───────────────────────────────────

  describe("generateSlug", () => {
    it("generates an 8-character slug", async () => {
      const slug = await generateSlug();
      expect(slug).toHaveLength(8);
      expect(slug).toMatch(/^[a-z0-9]+$/);
    });

    it("avoids collisions with existing slugs", async () => {
      // Fill storage with existing slugs
      const existingQuotes = Array.from({ length: 5 }, (_, i) =>
        makeQuote({ id: `q${i}`, slug: `slug${i}xx` })
      );
      mockStore.set("ksq_quotes", existingQuotes);

      const slug = await generateSlug();
      const existingSlugs = existingQuotes.map((q) => q.slug);
      expect(existingSlugs).not.toContain(slug);
    });
  });
});
