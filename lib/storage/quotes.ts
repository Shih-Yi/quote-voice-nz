import { get, set } from "idb-keyval";
import type { Quote } from "@/types/quote";
import {
  syncQuoteToSupabase,
  deleteQuoteFromSupabase,
} from "@/lib/supabase/quotes-api";
import {
  getQuoteBySlugFromSupabase,
  getQuoteByIdFromSupabase,
} from "@/lib/supabase/quotes";
import { getDeviceToken } from "./deviceToken";
import { mergeCloudQuote } from "./mergeQuote";
import { preCacheQuotePage } from "@/lib/utils/swCache";
import { logAudit } from "@/lib/utils/auditLog";
import { calculateQuoteTotals } from "@/lib/utils/gst";

// Recalculate subtotal/gst/total from items to ensure local consistency.
// The DB uses GENERATED ALWAYS columns so cloud data is always correct,
// but local IndexedDB must also reflect accurate totals for offline use.
function withRecalculatedTotals(quote: Quote): Quote {
  const totals = calculateQuoteTotals(quote.items, quote.gstInclusive);
  return { ...quote, ...totals };
}

const QUOTES_KEY = "ksq_quotes";
const SYNC_QUEUE_KEY = "ksq_sync_queue";
const DELETE_QUEUE_KEY = "ksq_delete_queue";
const SYNC_FAILURES_KEY = "ksq_sync_failures";
const DELETE_FAILURES_KEY = "ksq_delete_failures";

// Cap retry attempts so a permanently broken request (e.g. 403) doesn't hammer
// the server forever. After MAX_RETRY_ATTEMPTS, the ID is dropped from the
// queue and the user must re-save / re-delete to kick retries back off.
const MAX_RETRY_ATTEMPTS = 5;
// Exponential backoff base (ms). Delay before next attempt = BASE * 2^(attempts-1).
//   attempt 1 fail → wait 10s
//   attempt 2 fail → wait 20s
//   attempt 3 fail → wait 40s
//   attempt 4 fail → wait 80s
//   attempt 5 fail → give up
const BASE_BACKOFF_MS = 10_000;

interface RetryState {
  attempts: number;
  lastAttemptAt: string;
}

async function getRetryState(key: string, id: string): Promise<RetryState | undefined> {
  const map = (await get<Record<string, RetryState>>(key)) || {};
  return map[id];
}

async function recordRetryFailure(key: string, id: string): Promise<number> {
  const map = (await get<Record<string, RetryState>>(key)) || {};
  const prev = map[id];
  const attempts = (prev?.attempts ?? 0) + 1;
  map[id] = { attempts, lastAttemptAt: new Date().toISOString() };
  await set(key, map);
  return attempts;
}

async function clearRetryState(key: string, id: string): Promise<void> {
  const map = (await get<Record<string, RetryState>>(key)) || {};
  if (id in map) {
    delete map[id];
    await set(key, map);
  }
}

function isBackoffActive(state: RetryState): boolean {
  const delay = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, state.attempts - 1));
  return Date.now() - new Date(state.lastAttemptAt).getTime() < delay;
}

// --- Sync queue helpers (quote IDs that failed cloud sync and need retry) ---

async function addToSyncQueue(quoteId: string): Promise<void> {
  const queue = (await get<string[]>(SYNC_QUEUE_KEY)) || [];
  if (!queue.includes(quoteId)) {
    await set(SYNC_QUEUE_KEY, [...queue, quoteId]);
  }
}

async function removeFromSyncQueue(quoteId: string): Promise<void> {
  const queue = (await get<string[]>(SYNC_QUEUE_KEY)) || [];
  await set(SYNC_QUEUE_KEY, queue.filter((id) => id !== quoteId));
}

export async function getSyncQueue(): Promise<string[]> {
  return (await get<string[]>(SYNC_QUEUE_KEY)) || [];
}

// --- Delete queue helpers (quote IDs that failed cloud deletion and need retry) ---

async function addToDeleteQueue(quoteId: string): Promise<void> {
  const queue = (await get<string[]>(DELETE_QUEUE_KEY)) || [];
  if (!queue.includes(quoteId)) {
    await set(DELETE_QUEUE_KEY, [...queue, quoteId]);
  }
}

async function removeFromDeleteQueue(quoteId: string): Promise<void> {
  const queue = (await get<string[]>(DELETE_QUEUE_KEY)) || [];
  await set(DELETE_QUEUE_KEY, queue.filter((id) => id !== quoteId));
}

export async function getDeleteQueue(): Promise<string[]> {
  return (await get<string[]>(DELETE_QUEUE_KEY)) || [];
}

// Retry all queued cloud deletions — call this on app launch or when coming online
// On cloud-delete success we also physically purge the tombstone from local storage.
// Skipped IDs are in their backoff window; gaveUp IDs hit MAX_RETRY_ATTEMPTS and
// were force-purged locally (orphan row may remain on cloud).
export async function syncPendingDeletions(): Promise<{
  deleted: number;
  failed: number;
  skipped: number;
  gaveUp: number;
}> {
  const queue = await getDeleteQueue();
  if (queue.length === 0) return { deleted: 0, failed: 0, skipped: 0, gaveUp: 0 };

  const deviceToken = await getDeviceToken();
  let deleted = 0;
  let failed = 0;
  let skipped = 0;
  let gaveUp = 0;

  for (const quoteId of queue) {
    const state = await getRetryState(DELETE_FAILURES_KEY, quoteId);

    if (state && state.attempts >= MAX_RETRY_ATTEMPTS) {
      // Keep the local tombstone in place so we never create a cloud orphan
      // (user thought they deleted it, but the row persists in Supabase).
      // Drop from the auto-retry queue so we stop hammering the server. A
      // future explicit user action (re-save / re-delete / manual sync) can
      // re-queue it by clearing the failure state.
      console.error(
        `[syncPendingDeletions] GAVE UP id=${quoteId} after ${state.attempts} attempts — tombstone kept for manual resolution`
      );
      await removeFromDeleteQueue(quoteId);
      gaveUp++;
      continue;
    }

    if (state && isBackoffActive(state)) {
      skipped++;
      continue;
    }

    const result = await deleteQuoteFromSupabase(quoteId, deviceToken);
    if (result.success) {
      await purgeLocalQuote(quoteId);
      await removeFromDeleteQueue(quoteId);
      await clearRetryState(DELETE_FAILURES_KEY, quoteId);
      deleted++;
    } else if (result.retryable === false) {
      // The server will never accept this deletion (e.g. 403 on a quote that
      // is already sent/accepted). Keeping the tombstone would hide a quote
      // that still exists and is still publicly shareable, so restore it and
      // let the user see the truth.
      console.error(
        `[syncPendingDeletions] PERMANENT FAILURE id=${quoteId} status=${result.status} — ${result.error}; restoring local row`
      );
      await restoreTombstonedQuote(quoteId);
      await removeFromDeleteQueue(quoteId);
      await clearRetryState(DELETE_FAILURES_KEY, quoteId);
      gaveUp++;
    } else {
      await recordRetryFailure(DELETE_FAILURES_KEY, quoteId);
      failed++;
    }
  }

  return { deleted, failed, skipped, gaveUp };
}

// Internal: clear a tombstone, bringing the quote back into UI lists. Used
// when the cloud permanently refuses the deletion — the row still exists
// server-side, so pretending it's gone locally would mislead the user.
async function restoreTombstonedQuote(id: string): Promise<void> {
  const quotes = await getAllQuotesRaw();
  const index = quotes.findIndex((q) => q.id === id);
  if (index < 0 || !quotes[index].deletedAt) return;

  await set(
    QUOTES_KEY,
    quotes.map((q, i) => (i === index ? { ...q, deletedAt: undefined } : q))
  );
}

// Retry all queued quotes — call this on app launch or when coming online
// Skipped IDs are in their backoff window; gaveUp IDs hit MAX_RETRY_ATTEMPTS
// (quote stays local, dropped from auto-retry — re-saving re-queues).
export async function syncPendingQuotes(): Promise<{
  synced: number;
  failed: number;
  skipped: number;
  gaveUp: number;
}> {
  const queue = await getSyncQueue();
  if (queue.length === 0) return { synced: 0, failed: 0, skipped: 0, gaveUp: 0 };

  const deviceToken = await getDeviceToken();
  let synced = 0;
  let failed = 0;
  let skipped = 0;
  let gaveUp = 0;

  for (const quoteId of queue) {
    const quote = await findQuoteByIdRaw(quoteId);
    if (!quote || quote.deletedAt) {
      // Quote purged or tombstoned locally — don't sync a deleted quote
      await removeFromSyncQueue(quoteId);
      await clearRetryState(SYNC_FAILURES_KEY, quoteId);
      continue;
    }

    const state = await getRetryState(SYNC_FAILURES_KEY, quoteId);

    if (state && state.attempts >= MAX_RETRY_ATTEMPTS) {
      console.error(
        `[syncPendingQuotes] GAVE UP id=${quoteId} after ${state.attempts} attempts — dropping from queue`
      );
      await removeFromSyncQueue(quoteId);
      await clearRetryState(SYNC_FAILURES_KEY, quoteId);
      gaveUp++;
      continue;
    }

    if (state && isBackoffActive(state)) {
      skipped++;
      continue;
    }

    const result = await syncQuoteToSupabase(quote, deviceToken);
    if (result.success) {
      await removeFromSyncQueue(quoteId);
      await clearRetryState(SYNC_FAILURES_KEY, quoteId);
      await markQuoteCloudSynced(quoteId, {
        slug: result.slug,
        serverUpdatedAt: result.updatedAt,
        syncedUpdatedAt: quote.updatedAt,
      });
      synced++;
    } else if (result.retryable === false) {
      // Permanent rejection (403 ownership, 409 status conflict, 400 bad
      // payload). Retrying burns quota for a request that cannot succeed —
      // drop it now. The quote stays local; re-saving re-queues it.
      console.error(
        `[syncPendingQuotes] PERMANENT FAILURE id=${quoteId} status=${result.status} — ${result.error}`
      );
      await removeFromSyncQueue(quoteId);
      await clearRetryState(SYNC_FAILURES_KEY, quoteId);
      gaveUp++;
    } else {
      await recordRetryFailure(SYNC_FAILURES_KEY, quoteId);
      failed++;
    }
  }

  return { synced, failed, skipped, gaveUp };
}

// Internal: read the raw quotes array including tombstones.
// Used by sync machinery and slug-collision checks, which need to see deleted-but-not-yet-purged rows.
async function getAllQuotesRaw(): Promise<Quote[]> {
  const quotes = await get<Quote[]>(QUOTES_KEY);
  return quotes || [];
}

// Internal: find a quote by ID including tombstoned ones.
async function findQuoteByIdRaw(id: string): Promise<Quote | undefined> {
  const quotes = await getAllQuotesRaw();
  return quotes.find((q) => q.id === id);
}

// Internal: physically remove a quote from IndexedDB (used after confirmed cloud delete).
async function purgeLocalQuote(id: string): Promise<void> {
  const quotes = await getAllQuotesRaw();
  await set(QUOTES_KEY, quotes.filter((q) => q.id !== id));
}

// Internal: record that this quote reached the cloud, and adopt what the
// server considers authoritative — the slug (it resolves collisions) and
// updated_at (it stamps its own on every upsert).
//
// `cloudSyncedAt` is what lets deleteQuote tell "never uploaded" (safe to
// purge locally) apart from "uploaded, then edited offline" (a cloud row
// exists and must be deleted server-side, or we leave an orphan that hydrate
// would resurrect).
//
// Adopting updated_at matters for merge precedence: the server always writes
// its own timestamp, so a local copy keeping its client-generated one would
// look permanently older and lose every subsequent hydrate comparison.
// `syncedUpdatedAt` guards the race where the user edited the quote while the
// request was in flight — in that case the local row is genuinely newer and
// its timestamp must stand.
async function markQuoteCloudSynced(
  id: string,
  options: { slug?: string; serverUpdatedAt?: string; syncedUpdatedAt?: string } = {}
): Promise<void> {
  const quotes = await getAllQuotesRaw();
  const index = quotes.findIndex((q) => q.id === id);
  if (index < 0) return;

  const current = quotes[index];
  const slug = options.slug && options.slug !== current.slug ? options.slug : current.slug;
  const unchangedDuringFlight =
    !options.syncedUpdatedAt || current.updatedAt === options.syncedUpdatedAt;
  const updatedAt =
    options.serverUpdatedAt && unchangedDuringFlight
      ? options.serverUpdatedAt
      : current.updatedAt;

  await set(
    QUOTES_KEY,
    quotes.map((q, i) =>
      i === index
        ? { ...q, slug, updatedAt, cloudSyncedAt: new Date().toISOString() }
        : q
    )
  );
}

// Get all quotes from local storage (tombstoned quotes are hidden)
export async function getAllQuotes(): Promise<Quote[]> {
  const quotes = await getAllQuotesRaw();
  return quotes.filter((q) => !q.deletedAt);
}

// Get quote by ID (local only; tombstoned quotes are hidden)
export async function getQuoteById(id: string): Promise<Quote | undefined> {
  const quotes = await getAllQuotes();
  return quotes.find((q) => q.id === id);
}

// Fetch latest quote from cloud and update local storage.
// Safety rules:
//   1. Local ownership gate — must already have the quote locally (by id) OR
//      be signed in and the cloud row's user_id matches. Prevents anyone from
//      pulling an arbitrary quote by guessing its id (direct SELECT on the
//      table bypasses the slug-status filter used by public sharing).
//   2. Locally tombstoned quotes are NOT overwritten — the user has a pending delete.
//   3. Quotes still in the sync queue (local edits not yet uploaded) are NOT
//      overwritten — otherwise an older cloud snapshot would clobber pending
//      offline work.
//   4. If local exists and its updatedAt is newer than cloud, we keep local.
export async function refreshQuoteFromCloud(id: string): Promise<Quote | null> {
  // Rule 1a — refuse to fetch if we have no local record. The only way to
  // have a local record is to have created the quote on this device, so this
  // bounds access to quotes the caller demonstrably owns. Public-share access
  // uses slug (via getQuoteBySlug), not id.
  const quotes = await getAllQuotesRaw();
  const existing = quotes.find((q) => q.id === id);
  if (!existing) return null;
  if (existing.deletedAt) return null;

  const cloudQuote = await getQuoteByIdFromSupabase(id);
  if (!cloudQuote) return null;

  // Rule 1b — if the cloud row is bound to a user, only return it when the
  // local copy is bound to the same user. This protects against the case
  // where someone copies an id from a shared link into their own IndexedDB
  // by hand.
  if (cloudQuote.userId && existing.userId && cloudQuote.userId !== existing.userId) {
    return null;
  }

  // Pending local sync — our copy has changes the cloud hasn't seen yet.
  const pendingSync = (await getSyncQueue()).includes(id);
  if (pendingSync) return existing;

  // Local is newer — don't overwrite with stale cloud snapshot.
  if (new Date(existing.updatedAt) >= new Date(cloudQuote.updatedAt)) {
    return existing;
  }

  // Cloud wins, but local-only fields (attachments, signature, owner token)
  // never round-trip through Supabase — carry them over.
  const merged = mergeCloudQuote(existing, cloudQuote);
  const index = quotes.findIndex((q) => q.id === id);
  const updatedQuotes = quotes.map((q, i) => (i === index ? merged : q));

  await set(QUOTES_KEY, updatedQuotes);
  return merged;
}

// Get quote by slug — local first (offline-first), then Supabase for unknown slugs.
// Owners opening their own quotes hit IndexedDB instantly; shared public links still
// fall through to the cloud lookup.
export async function getQuoteBySlug(slug: string): Promise<Quote | undefined> {
  const quotes = await getAllQuotes();
  const local = quotes.find((q) => q.slug === slug);

  // Fetch cloud copy to enrich metadata that isn't persisted locally
  // (showWatermark and ownerTier — both derived from the creator's subscription
  // — and ownerProfile). Falls back to local-only when offline.
  const cloudQuote = await getQuoteBySlugFromSupabase(slug).catch(() => null);

  if (local) {
    if (cloudQuote) {
      return {
        ...local,
        showWatermark: cloudQuote.showWatermark,
        ownerProfile: cloudQuote.ownerProfile,
        ownerTier: cloudQuote.ownerTier,
      };
    }
    return local;
  }

  return cloudQuote ?? undefined;
}

// Save NEW quote - local first, optionally sync to Supabase.
// Return shape mirrors updateQuote: `syncError` on soft failure lets callers
// surface a "saved locally, cloud retry pending" warning instead of silently
// swallowing the failure.
export async function saveQuote(
  quote: Quote,
  options?: { localOnly?: boolean }
): Promise<{ synced: boolean; syncError?: string; slug?: string }> {
  // 1. Save locally first (offline-first) — upsert by ID to prevent duplicates.
  // Use the raw store so a tombstoned-but-not-yet-purged row gets overwritten in place
  // (deletedAt cleared) rather than appended as a duplicate.
  const quotes = await getAllQuotesRaw();
  const updatedQuote = withRecalculatedTotals({ ...quote, updatedAt: new Date().toISOString() });
  const existingIndex = quotes.findIndex((q) => q.id === quote.id);
  const isRevivedTombstone = existingIndex >= 0 && !!quotes[existingIndex].deletedAt;
  const updatedQuotes =
    existingIndex >= 0
      ? quotes.map((q, i) =>
          i === existingIndex ? { ...updatedQuote, deletedAt: undefined } : q
        )
      : [...quotes, updatedQuote];
  await set(QUOTES_KEY, updatedQuotes);

  // A revived tombstone means the user just resurrected a quote that was mid-delete;
  // drop it from the delete queue so we don't race to delete it again.
  if (isRevivedTombstone) {
    await removeFromDeleteQueue(updatedQuote.id);
    await clearRetryState(DELETE_FAILURES_KEY, updatedQuote.id);
  }

  logAudit(
    existingIndex >= 0 && !isRevivedTombstone ? "quote.updated" : "quote.created",
    "quote",
    updatedQuote.id,
    updatedQuote.customerName
  );

  // 2. Skip cloud sync if localOnly (e.g. voice recording → edit page)
  if (options?.localOnly) {
    await addToSyncQueue(updatedQuote.id);
    return { synced: false };
  }

  // 3. Try to sync to Supabase
  const deviceToken = await getDeviceToken();
  const result = await syncQuoteToSupabase(updatedQuote, deviceToken);

  if (result.success) {
    await removeFromSyncQueue(updatedQuote.id);
    await clearRetryState(SYNC_FAILURES_KEY, updatedQuote.id);
    // Records cloudSyncedAt and adopts the server's slug / updated_at.
    await markQuoteCloudSynced(updatedQuote.id, {
      slug: result.slug,
      serverUpdatedAt: result.updatedAt,
      syncedUpdatedAt: updatedQuote.updatedAt,
    });
    return { synced: true, slug: result.slug || updatedQuote.slug };
  }

  console.warn("[saveQuote] Cloud sync failed (local save succeeded):", result.error);
  if (result.retryable === false) {
    // Doomed request — don't queue it. The local save stands; the caller
    // surfaces syncError so the user knows the cloud copy is out of date.
    console.error(
      `[saveQuote] PERMANENT FAILURE id=${updatedQuote.id} status=${result.status} — ${result.error}`
    );
    return { synced: false, syncError: result.error || "Cloud sync rejected" };
  }
  await addToSyncQueue(updatedQuote.id);
  await recordRetryFailure(SYNC_FAILURES_KEY, updatedQuote.id);
  return { synced: false, syncError: result.error || "Cloud sync failed" };
}

// Update EXISTING quote - local first, then sync to Supabase
// Note: Only works for "draft" status quotes
// Return shape:
//   error     — hard failure (can't save; caller should surface and abort)
//   syncError — soft failure (saved locally, cloud retry pending; caller may warn)
export async function updateQuote(
  quote: Quote
): Promise<{ synced: boolean; error?: string; syncError?: string }> {
  // Check if quote is locked (sent/accepted)
  if (quote.status !== "draft") {
    return { synced: false, error: "Cannot edit sent quotes. Please duplicate instead." };
  }

  try {
    // 1. Update locally. Use raw store so tombstoned rows aren't ignored and
    // accidentally appended as a duplicate id.
    const quotes = await getAllQuotesRaw();
    const existingIndex = quotes.findIndex((q) => q.id === quote.id);

    if (existingIndex >= 0 && quotes[existingIndex].deletedAt) {
      return { synced: false, error: "Cannot update a deleted quote." };
    }

    const updatedQuote = withRecalculatedTotals({ ...quote, updatedAt: new Date().toISOString() });

    const updatedQuotes =
      existingIndex >= 0
        ? quotes.map((q, i) => (i === existingIndex ? updatedQuote : q))
        : [...quotes, updatedQuote];

    await set(QUOTES_KEY, updatedQuotes);

    // 2. Get device token and sync to Supabase (upsert — handles both new and existing)
    const deviceToken = await getDeviceToken();
    const result = await syncQuoteToSupabase(updatedQuote, deviceToken);

    if (result.success) {
      await removeFromSyncQueue(quote.id);
      await clearRetryState(SYNC_FAILURES_KEY, quote.id);
      await markQuoteCloudSynced(quote.id, {
        slug: result.slug,
        serverUpdatedAt: result.updatedAt,
        syncedUpdatedAt: updatedQuote.updatedAt,
      });
    } else if (result.retryable === false) {
      console.error(
        `[updateQuote] PERMANENT FAILURE id=${quote.id} status=${result.status} — ${result.error}`
      );
    } else {
      console.warn("[updateQuote] Cloud sync failed (local save succeeded):", result.error);
      await addToSyncQueue(quote.id);
      await recordRetryFailure(SYNC_FAILURES_KEY, quote.id);
    }

    logAudit("quote.updated", "quote", quote.id, quote.customerName);

    return {
      synced: result.success,
      ...(!result.success && { syncError: result.error || "Cloud sync failed" }),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[updateQuote] Unexpected error:", err);
    return { synced: false, error: `Save failed: ${message}` };
  }
}

// Mark quote as sent (locks the quote)
export async function markQuoteAsSent(
  quoteId: string
): Promise<{ synced: boolean; syncError?: string; error?: string }> {
  // Use the raw store — writing back a filtered list would accidentally drop
  // every other tombstone in storage.
  const quotes = await getAllQuotesRaw();
  const index = quotes.findIndex((q) => q.id === quoteId);

  if (index < 0 || quotes[index].deletedAt) {
    return { synced: false, error: "Quote not found" };
  }

  const updatedQuote = {
    ...quotes[index],
    status: "sent" as const,
    updatedAt: new Date().toISOString(),
  };

  await set(QUOTES_KEY, quotes.map((q, i) => (i === index ? updatedQuote : q)));

  // Sync to Supabase (upsert)
  const deviceToken = await getDeviceToken();
  const result = await syncQuoteToSupabase(updatedQuote, deviceToken);

  if (result.success) {
    await removeFromSyncQueue(quoteId);
    await clearRetryState(SYNC_FAILURES_KEY, quoteId);
    await markQuoteCloudSynced(quoteId, {
      slug: result.slug,
      serverUpdatedAt: result.updatedAt,
      syncedUpdatedAt: updatedQuote.updatedAt,
    });
  } else if (result.retryable === false) {
    console.error(
      `[markQuoteAsSent] PERMANENT FAILURE id=${quoteId} status=${result.status} — ${result.error}`
    );
  } else {
    console.warn("[markQuoteAsSent] Cloud sync failed (local save succeeded):", result.error);
    await addToSyncQueue(quoteId);
    await recordRetryFailure(SYNC_FAILURES_KEY, quoteId);
  }

  // Pre-cache the public quote page for offline sharing. Only meaningful once
  // the cloud knows the quote is "sent" — before that the public RPC filters
  // it out and we'd cache a "Quote Not Found" render.
  if (result.success && updatedQuote.slug) {
    preCacheQuotePage(updatedQuote.slug);
  }

  logAudit("quote.sent", "quote", quoteId, updatedQuote.customerName);

  return result.success
    ? { synced: true }
    : { synced: false, syncError: result.error || "Cloud sync failed" };
}

// Duplicate a quote (for editing sent quotes)
// Creates a new version with parent_id pointing to original
export async function duplicateQuote(quoteId: string): Promise<Quote | null> {
  const quotes = await getAllQuotes();
  const original = quotes.find((q) => q.id === quoteId);

  if (!original) {
    return null;
  }

  // Calculate next version number
  // If original has no parent, it's V1. New version = original.version + 1
  const nextVersion = (original.version || 1) + 1;

  // Find the root parent (for version chain)
  const rootParentId = original.parentId || original.id;

  // Create new quote with new ID, slug, and version tracking.
  // Drop per-send artefacts (customer signature, deletedAt tombstone) — those
  // belong to the specific sent quote, not to this new draft.
  const newQuote: Quote = {
    ...original,
    id: crypto.randomUUID(),
    slug: await generateSlug(),
    parentId: rootParentId,  // Points to original quote (root of version chain)
    version: nextVersion,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    signatureDataUrl: undefined,
    deletedAt: undefined,
    // Brand new id — the cloud has never seen this row.
    cloudSyncedAt: undefined,
  };

  const result = await saveQuote(newQuote);
  if (!result.synced) {
    // Local save still happened; caller can decide what to do. Log so the
    // soft-failure isn't completely invisible.
    console.warn(
      `[duplicateQuote] New version saved locally but cloud sync failed: ${result.syncError ?? "unknown"}`
    );
  }

  logAudit("quote.duplicated", "quote", newQuote.id, `V${nextVersion} from ${quoteId}`);

  return newQuote;
}

// Delete quote using tombstone pattern:
//   1. Mark the row with `deletedAt` so it disappears from UI lists.
//   2. Try cloud delete.
//   3. On success → physically purge locally.
//      On failure → keep the tombstone and queue for retry in syncPendingDeletions.
// This prevents the data-loss window where the local row is gone before we know
// the cloud accepted the delete.
//
// Fast path: if the quote demonstrably never reached the cloud (no
// cloudSyncedAt AND still queued for its first sync), we purge locally without
// a cloud call. Being in the sync queue is NOT sufficient on its own — a quote
// that synced successfully and later failed an edit is also queued, and
// skipping the cloud delete there would leave an orphan row that the next
// hydrate would resurrect.
export async function deleteQuote(
  id: string
): Promise<{ cloudDeleted: boolean; error?: string; permanent?: boolean }> {
  const raw = await getAllQuotesRaw();
  const existing = raw.find((q) => q.id === id);

  // Already purged or never existed — idempotent success.
  if (!existing) {
    await removeFromSyncQueue(id);
    await removeFromDeleteQueue(id);
    await clearRetryState(SYNC_FAILURES_KEY, id);
    await clearRetryState(DELETE_FAILURES_KEY, id);
    return { cloudDeleted: true };
  }

  const pendingSync = (await getSyncQueue()).includes(id);
  const neverSynced = !existing.cloudSyncedAt && pendingSync;

  // Fast path: never uploaded to cloud — just purge locally, no cloud round-trip needed.
  if (neverSynced) {
    await purgeLocalQuote(id);
    await removeFromSyncQueue(id);
    await removeFromDeleteQueue(id);
    await clearRetryState(SYNC_FAILURES_KEY, id);
    await clearRetryState(DELETE_FAILURES_KEY, id);
    logAudit("quote.deleted", "quote", id, existing.customerName);
    return { cloudDeleted: true };
  }

  // Tombstone: mark deletedAt so UI lists hide it, but keep the row until cloud confirms.
  const tombstoned: Quote = { ...existing, deletedAt: new Date().toISOString() };
  await set(
    QUOTES_KEY,
    raw.map((q) => (q.id === id ? tombstoned : q))
  );
  await removeFromSyncQueue(id);

  logAudit("quote.deleted", "quote", id, existing.customerName);

  const deviceToken = await getDeviceToken();
  const deleteResult = await deleteQuoteFromSupabase(id, deviceToken);

  if (deleteResult.success) {
    // Cloud confirmed — safe to physically remove.
    await purgeLocalQuote(id);
    await removeFromDeleteQueue(id);
    await clearRetryState(DELETE_FAILURES_KEY, id);
    return { cloudDeleted: true };
  }

  if (deleteResult.retryable === false) {
    // Server permanently refuses (e.g. the quote is already sent/accepted).
    // Undo the tombstone so the list keeps showing a quote that genuinely
    // still exists, and tell the caller not to navigate away.
    console.error(
      `[deleteQuote] PERMANENT FAILURE id=${id} status=${deleteResult.status} — ${deleteResult.error}`
    );
    await restoreTombstonedQuote(id);
    await removeFromDeleteQueue(id);
    await clearRetryState(DELETE_FAILURES_KEY, id);
    return {
      cloudDeleted: false,
      error: deleteResult.error || "Cloud rejected the deletion",
      permanent: true,
    };
  }

  console.warn("[deleteQuote] Cloud deletion failed, queued for retry:", deleteResult.error);
  await addToDeleteQueue(id);
  await recordRetryFailure(DELETE_FAILURES_KEY, id);

  return { cloudDeleted: false, error: deleteResult.error };
}

// Get recent quotes (local)
export async function getRecentQuotes(limit: number = 10): Promise<Quote[]> {
  const quotes = await getAllQuotes();
  return quotes
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

// Generate unique slug — checks local storage (including tombstones) to avoid collisions.
// Tombstoned quotes still occupy their slug on the server until cloud delete confirms.
export async function generateSlug(): Promise<string> {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const quotes = await getAllQuotesRaw();
  const existingSlugs = new Set(quotes.map((q) => q.slug).filter(Boolean));

  let slug = "";
  let attempts = 0;
  do {
    slug = Array.from({ length: 8 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join("");
    attempts++;
  } while (existingSlugs.has(slug) && attempts < 10);

  return slug;
}

// Count quotes on this device
export async function countLocalQuotes(): Promise<number> {
  const quotes = await getAllQuotes();
  return quotes.length;
}
