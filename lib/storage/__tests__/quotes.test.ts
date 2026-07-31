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

const mockGetQuoteByIdFromSupabase = vi.fn().mockResolvedValue(null);
const mockGetQuoteBySlugFromSupabase = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/supabase/quotes", () => ({
  getQuoteBySlugFromSupabase: (...args: unknown[]) => mockGetQuoteBySlugFromSupabase(...args),
  getQuoteByIdFromSupabase: (...args: unknown[]) => mockGetQuoteByIdFromSupabase(...args),
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
  refreshQuoteFromCloud,
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
    mockGetQuoteByIdFromSupabase.mockReset().mockResolvedValue(null);
    mockGetQuoteBySlugFromSupabase.mockReset().mockResolvedValue(null);
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

    it("returns syncError when cloud sync fails", async () => {
      mockSyncQuoteToSupabase.mockResolvedValue({ success: false, error: "Network error" });

      const result = await saveQuote(makeQuote({ id: "err-q" }));
      expect(result.synced).toBe(false);
      expect(result.syncError).toBe("Network error");
    });

    it("returns finalised slug when server resolves collision", async () => {
      mockSyncQuoteToSupabase.mockResolvedValue({ success: true, slug: "server-slug" });

      const result = await saveQuote(makeQuote({ id: "slug-q", slug: "client-slug" }));
      expect(result.synced).toBe(true);
      expect(result.slug).toBe("server-slug");

      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored[0].slug).toBe("server-slug");
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

    it("revives a tombstoned row in-place rather than duplicating", async () => {
      const tomb = makeQuote({
        id: "revive-q",
        deletedAt: "2026-03-01T00:00:00Z",
      });
      mockStore.set("ksq_quotes", [tomb]);
      mockStore.set("ksq_delete_queue", ["revive-q"]);

      await saveQuote(makeQuote({ id: "revive-q", customerName: "Revived" }));

      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored).toHaveLength(1);
      expect(stored[0].deletedAt).toBeUndefined();
      expect(stored[0].customerName).toBe("Revived");
      // Revival drops the delete-queue entry so we don't race to re-delete.
      expect((mockStore.get("ksq_delete_queue") as string[]) ?? []).not.toContain("revive-q");
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

    it("refuses to update a tombstoned quote", async () => {
      const tomb = makeQuote({
        id: "tomb-upd",
        deletedAt: "2026-03-01T00:00:00Z",
      });
      mockStore.set("ksq_quotes", [tomb]);

      const result = await updateQuote(tomb);
      expect(result.synced).toBe(false);
      expect(result.error).toBe("Cannot update a deleted quote.");
      expect(mockSyncQuoteToSupabase).not.toHaveBeenCalled();
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

    it("does NOT take the fast path for a synced quote with queued edits (audit #4)", async () => {
      // Synced once, then an offline edit failed and re-queued it. The cloud
      // row exists, so skipping the cloud delete would orphan it.
      mockStore.set("ksq_quotes", [
        makeQuote({ id: "edited-q", cloudSyncedAt: "2026-01-02T00:00:00Z" }),
      ]);
      mockStore.set("ksq_sync_queue", ["edited-q"]);

      await deleteQuote("edited-q");

      expect(mockDeleteQuoteFromSupabase).toHaveBeenCalledWith(
        "edited-q",
        "dt_test_device_token"
      );
    });

    it("restores the tombstone and reports permanent when the cloud refuses (audit #5)", async () => {
      mockDeleteQuoteFromSupabase.mockResolvedValue({
        success: false,
        error: "Cannot delete a quote that has been sent",
        status: 403,
        retryable: false,
      });
      mockStore.set("ksq_quotes", [makeQuote({ id: "locked-q" })]);

      const result = await deleteQuote("locked-q");

      expect(result.permanent).toBe(true);
      expect(result.cloudDeleted).toBe(false);
      // Row is visible again — it genuinely still exists in the cloud.
      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored).toHaveLength(1);
      expect(stored[0].deletedAt).toBeUndefined();
      // And it is not left retrying a doomed request.
      const deleteQueue = (mockStore.get("ksq_delete_queue") as string[]) ?? [];
      expect(deleteQueue).not.toContain("locked-q");
    });
  });

  // ─── GET BY SLUG ─────────────────────────────────────

  describe("getQuoteBySlug", () => {
    it("returns the local quote even when cloud lookup is offline", async () => {
      const local = makeQuote({ id: "loc-q", slug: "localslug" });
      mockStore.set("ksq_quotes", [local]);
      mockGetQuoteBySlugFromSupabase.mockRejectedValueOnce(new Error("offline"));

      const { getQuoteBySlug } = await import("../quotes");
      const result = await getQuoteBySlug("localslug");

      expect(result?.id).toBe("loc-q");
    });

    it("falls back to cloud when slug is unknown locally", async () => {
      const cloud = makeQuote({ id: "cloud-q", slug: "cloudslug" });
      mockGetQuoteBySlugFromSupabase.mockResolvedValue(cloud);

      const { getQuoteBySlug } = await import("../quotes");
      const result = await getQuoteBySlug("cloudslug");

      expect(result?.id).toBe("cloud-q");
      expect(mockGetQuoteBySlugFromSupabase).toHaveBeenCalledWith("cloudslug");
    });

    it("returns undefined when slug is unknown locally and in cloud", async () => {
      const { getQuoteBySlug } = await import("../quotes");
      const result = await getQuoteBySlug("missing");

      expect(result).toBeUndefined();
    });

    it("does not return tombstoned local match", async () => {
      const tomb = makeQuote({
        id: "tomb-q",
        slug: "tombslug",
        deletedAt: "2026-03-01T00:00:00Z",
      });
      mockStore.set("ksq_quotes", [tomb]);

      const { getQuoteBySlug } = await import("../quotes");
      const result = await getQuoteBySlug("tombslug");

      // Tombstoned — falls through to cloud (which returns null here).
      expect(result).toBeUndefined();
      expect(mockGetQuoteBySlugFromSupabase).toHaveBeenCalled();
    });
  });

  // ─── REFRESH FROM CLOUD ──────────────────────────────

  describe("refreshQuoteFromCloud", () => {
    it("does not clobber local when it's pending sync", async () => {
      const local = makeQuote({
        id: "pending-q",
        customerName: "Local edit",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      const cloud = makeQuote({
        id: "pending-q",
        customerName: "Older cloud",
        updatedAt: "2025-12-01T00:00:00Z",
      });
      mockStore.set("ksq_quotes", [local]);
      mockStore.set("ksq_sync_queue", ["pending-q"]);
      mockGetQuoteByIdFromSupabase.mockResolvedValue(cloud);

      const { refreshQuoteFromCloud } = await import("../quotes");
      const result = await refreshQuoteFromCloud("pending-q");

      expect(result?.customerName).toBe("Local edit");
      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored[0].customerName).toBe("Local edit");
    });

    it("does not clobber local when local is newer than cloud", async () => {
      const local = makeQuote({
        id: "newer-q",
        customerName: "Fresh local",
        updatedAt: "2026-02-01T00:00:00Z",
      });
      const cloud = makeQuote({
        id: "newer-q",
        customerName: "Stale cloud",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      mockStore.set("ksq_quotes", [local]);
      mockGetQuoteByIdFromSupabase.mockResolvedValue(cloud);

      const { refreshQuoteFromCloud } = await import("../quotes");
      const result = await refreshQuoteFromCloud("newer-q");

      expect(result?.customerName).toBe("Fresh local");
    });

    it("overwrites local when cloud is newer and no pending sync", async () => {
      const local = makeQuote({
        id: "old-q",
        customerName: "Stale local",
        updatedAt: "2026-01-01T00:00:00Z",
      });
      const cloud = makeQuote({
        id: "old-q",
        customerName: "Fresh cloud",
        updatedAt: "2026-02-01T00:00:00Z",
      });
      mockStore.set("ksq_quotes", [local]);
      mockGetQuoteByIdFromSupabase.mockResolvedValue(cloud);

      const { refreshQuoteFromCloud } = await import("../quotes");
      const result = await refreshQuoteFromCloud("old-q");

      expect(result?.customerName).toBe("Fresh cloud");
      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored[0].customerName).toBe("Fresh cloud");
    });

    it("returns null for locally tombstoned quotes (no overwrite)", async () => {
      const tombstone = makeQuote({
        id: "tomb-q",
        deletedAt: "2026-03-01T00:00:00Z",
      });
      mockStore.set("ksq_quotes", [tombstone]);
      mockGetQuoteByIdFromSupabase.mockResolvedValue(makeQuote({ id: "tomb-q" }));

      const { refreshQuoteFromCloud } = await import("../quotes");
      const result = await refreshQuoteFromCloud("tomb-q");

      expect(result).toBeNull();
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

      // Simulate enough time passing so the retry isn't blocked by backoff.
      mockStore.set("ksq_delete_failures", {
        "retry-q": { attempts: 1, lastAttemptAt: "2020-01-01T00:00:00Z" },
      });

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
      expect(result.error).toBe("Quote not found");
    });

    it("returns synced: true on successful cloud sync", async () => {
      mockStore.set("ksq_quotes", [makeQuote({ id: "send-q" })]);

      const result = await markQuoteAsSent("send-q");
      expect(result.synced).toBe(true);
      expect(result.syncError).toBeUndefined();
    });

    it("returns syncError when cloud sync fails", async () => {
      mockSyncQuoteToSupabase.mockResolvedValue({ success: false, error: "Timeout" });
      mockStore.set("ksq_quotes", [makeQuote({ id: "send-q" })]);

      const result = await markQuoteAsSent("send-q");
      expect(result.synced).toBe(false);
      expect(result.syncError).toBe("Timeout");
      expect(result.error).toBeUndefined();
    });

    it("adds to sync queue when cloud sync fails", async () => {
      mockSyncQuoteToSupabase.mockResolvedValue({ success: false, error: "Offline" });
      mockStore.set("ksq_quotes", [makeQuote({ id: "send-q" })]);

      await markQuoteAsSent("send-q");

      const queue = mockStore.get("ksq_sync_queue") as string[];
      expect(queue).toContain("send-q");
    });

    it("preserves other tombstones when writing back", async () => {
      const tomb = makeQuote({
        id: "other-tomb",
        deletedAt: "2026-03-01T00:00:00Z",
      });
      const draft = makeQuote({ id: "send-q" });
      mockStore.set("ksq_quotes", [tomb, draft]);

      await markQuoteAsSent("send-q");

      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored).toHaveLength(2);
      expect(stored.find((q) => q.id === "other-tomb")?.deletedAt).toBe("2026-03-01T00:00:00Z");
    });

    it("refuses to mark a tombstoned quote as sent", async () => {
      const tomb = makeQuote({ id: "tomb-send", deletedAt: "2026-03-01T00:00:00Z" });
      mockStore.set("ksq_quotes", [tomb]);

      const result = await markQuoteAsSent("tomb-send");
      expect(result.synced).toBe(false);
      expect(result.error).toBe("Quote not found");
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

    it("does not carry signatureDataUrl into the new version", async () => {
      const original = makeQuote({
        id: "sig-orig",
        version: 1,
        signatureDataUrl: "data:image/png;base64,AAA",
      });
      mockStore.set("ksq_quotes", [original]);

      const dup = await duplicateQuote("sig-orig");
      expect(dup!.signatureDataUrl).toBeUndefined();
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
      expect(result).toEqual({ synced: 0, failed: 0, skipped: 0, gaveUp: 0 });
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

    it("skips IDs still in backoff window", async () => {
      mockSyncQuoteToSupabase.mockResolvedValue({ success: false, error: "Offline" });

      mockStore.set("ksq_quotes", [makeQuote({ id: "wait-q" })]);
      mockStore.set("ksq_sync_queue", ["wait-q"]);
      // Failed 1ms ago → still within the 10s base backoff.
      mockStore.set("ksq_sync_failures", {
        "wait-q": { attempts: 1, lastAttemptAt: new Date().toISOString() },
      });

      const result = await syncPendingQuotes();

      expect(mockSyncQuoteToSupabase).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
      expect(result.failed).toBe(0);
    });

    it("gives up after MAX_RETRY_ATTEMPTS and removes from queue", async () => {
      mockStore.set("ksq_quotes", [makeQuote({ id: "dead-q" })]);
      mockStore.set("ksq_sync_queue", ["dead-q"]);
      mockStore.set("ksq_sync_failures", {
        "dead-q": { attempts: 5, lastAttemptAt: "2020-01-01T00:00:00Z" },
      });

      const result = await syncPendingQuotes();

      expect(mockSyncQuoteToSupabase).not.toHaveBeenCalled();
      expect(result.gaveUp).toBe(1);
      expect((mockStore.get("ksq_sync_queue") as string[])).not.toContain("dead-q");
      const failures = mockStore.get("ksq_sync_failures") as Record<string, unknown>;
      expect(failures["dead-q"]).toBeUndefined();
    });

    it("increments attempt counter on failure", async () => {
      mockSyncQuoteToSupabase.mockResolvedValue({ success: false, error: "Timeout" });

      mockStore.set("ksq_quotes", [makeQuote({ id: "retry-q" })]);
      mockStore.set("ksq_sync_queue", ["retry-q"]);
      mockStore.set("ksq_sync_failures", {
        "retry-q": { attempts: 2, lastAttemptAt: "2020-01-01T00:00:00Z" },
      });

      await syncPendingQuotes();

      const failures = mockStore.get("ksq_sync_failures") as Record<string, { attempts: number }>;
      expect(failures["retry-q"].attempts).toBe(3);
    });

    it("clears failure counter on successful retry", async () => {
      mockStore.set("ksq_quotes", [makeQuote({ id: "recover-q" })]);
      mockStore.set("ksq_sync_queue", ["recover-q"]);
      mockStore.set("ksq_sync_failures", {
        "recover-q": { attempts: 3, lastAttemptAt: "2020-01-01T00:00:00Z" },
      });

      await syncPendingQuotes();

      const failures = mockStore.get("ksq_sync_failures") as Record<string, unknown>;
      expect(failures["recover-q"]).toBeUndefined();
    });

    it("records cloudSyncedAt on success so deleteQuote can see it reached the cloud", async () => {
      mockStore.set("ksq_quotes", [makeQuote({ id: "mark-q" })]);
      mockStore.set("ksq_sync_queue", ["mark-q"]);

      await syncPendingQuotes();

      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored[0].cloudSyncedAt).toBeTruthy();
    });

    it("drops permanently-rejected quotes instead of burning retries (audit #5)", async () => {
      mockSyncQuoteToSupabase.mockResolvedValue({
        success: false,
        error: "Access denied",
        status: 403,
        retryable: false,
      });
      mockStore.set("ksq_quotes", [makeQuote({ id: "denied-q" })]);
      mockStore.set("ksq_sync_queue", ["denied-q"]);

      const result = await syncPendingQuotes();

      expect(result.gaveUp).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockStore.get("ksq_sync_queue")).not.toContain("denied-q");
      const failures = (mockStore.get("ksq_sync_failures") ?? {}) as Record<string, unknown>;
      expect(failures["denied-q"]).toBeUndefined();
    });
  });

  describe("syncPendingDeletions retry/backoff", () => {
    it("gives up after MAX_RETRY_ATTEMPTS — keeps local tombstone to avoid cloud orphans (audit #6)", async () => {
      mockStore.set("ksq_quotes", [
        makeQuote({ id: "dead-del-q", deletedAt: new Date().toISOString() }),
      ]);
      mockStore.set("ksq_delete_queue", ["dead-del-q"]);
      mockStore.set("ksq_delete_failures", {
        "dead-del-q": { attempts: 5, lastAttemptAt: "2020-01-01T00:00:00Z" },
      });

      const { syncPendingDeletions } = await import("../quotes");
      const result = await syncPendingDeletions();

      expect(mockDeleteQuoteFromSupabase).not.toHaveBeenCalled();
      expect(result.gaveUp).toBe(1);
      // Tombstone stays — prevents cloud orphan (user thought they deleted it).
      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored).toHaveLength(1);
      expect(stored[0].deletedAt).toBeTruthy();
      // But it's dropped from auto-retry to stop hammering the server.
      expect((mockStore.get("ksq_delete_queue") as string[])).not.toContain("dead-del-q");
    });

    it("restores the local row when the cloud permanently refuses (audit #5)", async () => {
      mockDeleteQuoteFromSupabase.mockResolvedValue({
        success: false,
        error: "Cannot delete a quote that has been sent",
        status: 403,
        retryable: false,
      });
      mockStore.set("ksq_quotes", [
        makeQuote({ id: "refused-del-q", deletedAt: new Date().toISOString() }),
      ]);
      mockStore.set("ksq_delete_queue", ["refused-del-q"]);

      const { syncPendingDeletions } = await import("../quotes");
      const result = await syncPendingDeletions();

      expect(result.gaveUp).toBe(1);
      expect(result.failed).toBe(0);
      // Tombstone rolled back — the quote still exists in the cloud, so
      // hiding it locally would misrepresent reality.
      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored[0].deletedAt).toBeUndefined();
      expect((mockStore.get("ksq_delete_queue") as string[])).not.toContain(
        "refused-del-q"
      );
    });

    it("skips delete IDs in backoff window", async () => {
      mockDeleteQuoteFromSupabase.mockResolvedValue({ success: false, error: "Offline" });
      mockStore.set("ksq_quotes", [
        makeQuote({ id: "wait-del-q", deletedAt: new Date().toISOString() }),
      ]);
      mockStore.set("ksq_delete_queue", ["wait-del-q"]);
      mockStore.set("ksq_delete_failures", {
        "wait-del-q": { attempts: 1, lastAttemptAt: new Date().toISOString() },
      });

      const { syncPendingDeletions } = await import("../quotes");
      const result = await syncPendingDeletions();

      expect(mockDeleteQuoteFromSupabase).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
    });

    it("attempts=4 still attempts cloud delete (boundary: not yet at MAX_RETRY_ATTEMPTS=5)", async () => {
      mockDeleteQuoteFromSupabase.mockResolvedValue({ success: false, error: "Timeout" });
      mockStore.set("ksq_quotes", [
        makeQuote({ id: "edge-del-q", deletedAt: new Date().toISOString() }),
      ]);
      mockStore.set("ksq_delete_queue", ["edge-del-q"]);
      // 4 attempts at lastAttempt long enough ago that backoff has elapsed.
      mockStore.set("ksq_delete_failures", {
        "edge-del-q": { attempts: 4, lastAttemptAt: "2020-01-01T00:00:00Z" },
      });

      const { syncPendingDeletions } = await import("../quotes");
      const result = await syncPendingDeletions();

      expect(mockDeleteQuoteFromSupabase).toHaveBeenCalledOnce();
      expect(result.failed).toBe(1);
      expect(result.gaveUp).toBe(0);
      // Failure counter advances to 5 — next pass will give up.
      const failures = mockStore.get("ksq_delete_failures") as Record<
        string,
        { attempts: number }
      >;
      expect(failures["edge-del-q"].attempts).toBe(5);
    });

    it("after giveUp, tombstone stays hidden from getAllQuotes() but visible to sync internals", async () => {
      mockStore.set("ksq_quotes", [
        makeQuote({ id: "ghost-q", deletedAt: new Date().toISOString() }),
        makeQuote({ id: "live-q" }),
      ]);
      mockStore.set("ksq_delete_queue", ["ghost-q"]);
      mockStore.set("ksq_delete_failures", {
        "ghost-q": { attempts: 5, lastAttemptAt: "2020-01-01T00:00:00Z" },
      });

      const { syncPendingDeletions } = await import("../quotes");
      await syncPendingDeletions();

      // UI must not show the gave-up tombstone — feels deleted from the user's
      // perspective even though the cloud row may remain.
      const visible = await getAllQuotes();
      expect(visible.map((q) => q.id)).toEqual(["live-q"]);
    });

    it("re-deleting a gave-up quote clears retry state so a fresh sync runs", async () => {
      mockStore.set("ksq_quotes", [
        makeQuote({ id: "revive-del", deletedAt: new Date().toISOString() }),
      ]);
      // Previous giveUp left a stale failure counter at 5 and dropped from queue.
      mockStore.set("ksq_delete_queue", []);
      mockStore.set("ksq_delete_failures", {
        "revive-del": { attempts: 5, lastAttemptAt: "2020-01-01T00:00:00Z" },
      });

      // User explicitly deletes again — deleteQuote() clears retry state.
      mockDeleteQuoteFromSupabase.mockResolvedValueOnce({ success: true });
      await deleteQuote("revive-del");

      const failures = mockStore.get("ksq_delete_failures") as Record<string, unknown>;
      expect(failures["revive-del"]).toBeUndefined();
    });

    it("mixed queue: gave-up + backoff + fresh-failure handled independently in one pass", async () => {
      mockStore.set("ksq_quotes", [
        makeQuote({ id: "dead", deletedAt: new Date().toISOString() }),
        makeQuote({ id: "wait", deletedAt: new Date().toISOString() }),
        makeQuote({ id: "fresh", deletedAt: new Date().toISOString() }),
      ]);
      mockStore.set("ksq_delete_queue", ["dead", "wait", "fresh"]);
      mockStore.set("ksq_delete_failures", {
        dead: { attempts: 5, lastAttemptAt: "2020-01-01T00:00:00Z" },
        wait: { attempts: 1, lastAttemptAt: new Date().toISOString() },
        // fresh: no failure state — attempts cloud call
      });
      mockDeleteQuoteFromSupabase.mockResolvedValue({
        success: false,
        error: "Network",
      });

      const { syncPendingDeletions } = await import("../quotes");
      const result = await syncPendingDeletions();

      // Only `fresh` reaches the network — `dead` short-circuits to giveUp,
      // `wait` short-circuits to backoff.
      expect(mockDeleteQuoteFromSupabase).toHaveBeenCalledTimes(1);
      expect(result.gaveUp).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.failed).toBe(1);

      const queue = mockStore.get("ksq_delete_queue") as string[];
      expect(queue).toContain("wait"); // still queued, in backoff
      expect(queue).toContain("fresh"); // still queued, will retry
      expect(queue).not.toContain("dead"); // dropped from auto-retry
    });
  });

  describe("syncPendingQuotes — retry exhaustion side effects", () => {
    it("after giveUp, quote is still locally readable (kept for user re-action)", async () => {
      mockStore.set("ksq_quotes", [makeQuote({ id: "stuck-q", customerName: "ACME" })]);
      mockStore.set("ksq_sync_queue", ["stuck-q"]);
      mockStore.set("ksq_sync_failures", {
        "stuck-q": { attempts: 5, lastAttemptAt: "2020-01-01T00:00:00Z" },
      });

      await syncPendingQuotes();

      // Quote is NOT purged — user can still see/edit it. Re-saving will
      // re-queue with a clean retry counter (since giveUp cleared state).
      const local = await getQuoteById("stuck-q");
      expect(local).toBeDefined();
      expect(local?.customerName).toBe("ACME");
    });

    it("re-saving a gave-up quote re-queues it with a fresh retry counter", async () => {
      const quote = makeQuote({ id: "retry-q", customerName: "Reborn" });
      mockStore.set("ksq_quotes", [quote]);
      mockStore.set("ksq_sync_queue", ["retry-q"]);
      mockStore.set("ksq_sync_failures", {
        "retry-q": { attempts: 5, lastAttemptAt: "2020-01-01T00:00:00Z" },
      });

      // First syncPendingQuotes pass gives up and clears retry state for sync.
      await syncPendingQuotes();
      const queueAfterGiveup = mockStore.get("ksq_sync_queue") as string[];
      expect(queueAfterGiveup).not.toContain("retry-q");

      // User re-saves with cloud failing again.
      mockSyncQuoteToSupabase.mockResolvedValueOnce({ success: false, error: "Network" });
      await saveQuote(quote);

      // Re-queued with attempts back at 1 (state was cleared at giveUp).
      const queueAfterResave = mockStore.get("ksq_sync_queue") as string[];
      expect(queueAfterResave).toContain("retry-q");
      const failures = mockStore.get("ksq_sync_failures") as Record<
        string,
        { attempts: number }
      >;
      expect(failures["retry-q"].attempts).toBe(1);
    });
  });

  // ─── GENERATE SLUG ───────────────────────────────────

  describe("generateSlug", () => {
    // 16 base36 characters ≈ 2^82.7. The slug is the only gate on the public
    // /q/[slug] page, and the old 8-character form was ≈ 2^41 — brute-forcible
    // once enough quotes exist to make a hit likely.
    it("generates a 16-character slug", async () => {
      const slug = await generateSlug();
      expect(slug).toHaveLength(16);
      expect(slug).toMatch(/^[a-z0-9]+$/);
    });

    it("does not repeat itself across many draws", async () => {
      const slugs = new Set<string>();
      for (let i = 0; i < 200; i++) slugs.add(await generateSlug());
      expect(slugs.size).toBe(200);
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

  // ─── REFRESH FROM CLOUD — OWNERSHIP GATES (audit #7) ─

  describe("refreshQuoteFromCloud", () => {
    it("refuses to fetch when quote is not present locally", async () => {
      mockStore.set("ksq_quotes", []);
      mockGetQuoteByIdFromSupabase.mockClear();

      const result = await refreshQuoteFromCloud("some-random-id");

      expect(result).toBeNull();
      expect(mockGetQuoteByIdFromSupabase).not.toHaveBeenCalled();
    });

    it("refuses to fetch when the local row is tombstoned", async () => {
      const q = makeQuote({ id: "q-tomb", deletedAt: "2026-02-01T00:00:00Z" });
      mockStore.set("ksq_quotes", [q]);
      mockGetQuoteByIdFromSupabase.mockClear();

      const result = await refreshQuoteFromCloud("q-tomb");

      expect(result).toBeNull();
      expect(mockGetQuoteByIdFromSupabase).not.toHaveBeenCalled();
    });

    it("rejects cloud row bound to a different user_id", async () => {
      const local = makeQuote({ id: "q1", userId: "user-a", updatedAt: "2026-02-01T00:00:00Z" });
      mockStore.set("ksq_quotes", [local]);
      mockGetQuoteByIdFromSupabase.mockResolvedValueOnce(
        makeQuote({ id: "q1", userId: "user-b", updatedAt: "2026-03-01T00:00:00Z" })
      );

      const result = await refreshQuoteFromCloud("q1");

      expect(result).toBeNull();
      const stored = mockStore.get("ksq_quotes") as Quote[];
      expect(stored[0].userId).toBe("user-a"); // local untouched
    });

    it("accepts cloud row when user_ids match", async () => {
      const local = makeQuote({ id: "q1", userId: "user-a", updatedAt: "2026-02-01T00:00:00Z" });
      const cloud = makeQuote({
        id: "q1",
        userId: "user-a",
        updatedAt: "2026-03-01T00:00:00Z",
        customerName: "Updated Name",
      });
      mockStore.set("ksq_quotes", [local]);
      mockGetQuoteByIdFromSupabase.mockResolvedValueOnce(cloud);

      const result = await refreshQuoteFromCloud("q1");

      expect(result?.customerName).toBe("Updated Name");
    });

    it("accepts anonymous cloud row when local is also anonymous", async () => {
      const local = makeQuote({ id: "q1", userId: undefined, updatedAt: "2026-02-01T00:00:00Z" });
      const cloud = makeQuote({
        id: "q1",
        userId: undefined,
        updatedAt: "2026-03-01T00:00:00Z",
        customerName: "Fresh",
      });
      mockStore.set("ksq_quotes", [local]);
      mockGetQuoteByIdFromSupabase.mockResolvedValueOnce(cloud);

      const result = await refreshQuoteFromCloud("q1");

      expect(result?.customerName).toBe("Fresh");
    });

    it("keeps local when it has pending sync (cloud snapshot is stale)", async () => {
      const local = makeQuote({ id: "q1", customerName: "Local Draft" });
      mockStore.set("ksq_quotes", [local]);
      mockStore.set("ksq_sync_queue", ["q1"]);
      mockGetQuoteByIdFromSupabase.mockResolvedValueOnce(
        makeQuote({ id: "q1", customerName: "Stale Cloud" })
      );

      const result = await refreshQuoteFromCloud("q1");

      expect(result?.customerName).toBe("Local Draft");
    });
  });
});
