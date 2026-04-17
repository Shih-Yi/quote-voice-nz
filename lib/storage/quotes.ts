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
export async function syncPendingDeletions(): Promise<{ deleted: number; failed: number }> {
  const queue = await getDeleteQueue();
  if (queue.length === 0) return { deleted: 0, failed: 0 };

  const deviceToken = await getDeviceToken();
  let deleted = 0;
  let failed = 0;

  for (const quoteId of queue) {
    const result = await deleteQuoteFromSupabase(quoteId, deviceToken);
    if (result.success) {
      await removeFromDeleteQueue(quoteId);
      deleted++;
    } else {
      failed++;
    }
  }

  return { deleted, failed };
}

// Retry all queued quotes — call this on app launch or when coming online
export async function syncPendingQuotes(): Promise<{ synced: number; failed: number }> {
  const queue = await getSyncQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  const deviceToken = await getDeviceToken();
  let synced = 0;
  let failed = 0;

  for (const quoteId of queue) {
    const quote = await getQuoteById(quoteId);
    if (!quote) {
      // Quote deleted locally — remove from queue silently
      await removeFromSyncQueue(quoteId);
      continue;
    }

    const result = await syncQuoteToSupabase(quote, deviceToken);
    if (result.success) {
      await removeFromSyncQueue(quoteId);
      synced++;
    } else {
      failed++;
    }
  }

  return { synced, failed };
}

// Get all quotes from local storage
export async function getAllQuotes(): Promise<Quote[]> {
  const quotes = await get<Quote[]>(QUOTES_KEY);
  return quotes || [];
}

// Get quote by ID (local only)
export async function getQuoteById(id: string): Promise<Quote | undefined> {
  const quotes = await getAllQuotes();
  return quotes.find((q) => q.id === id);
}

// Fetch latest quote from cloud and update local storage
export async function refreshQuoteFromCloud(id: string): Promise<Quote | null> {
  const cloudQuote = await getQuoteByIdFromSupabase(id);
  if (!cloudQuote) return null;

  const quotes = await getAllQuotes();
  const index = quotes.findIndex((q) => q.id === id);

  const updatedQuotes =
    index >= 0
      ? quotes.map((q, i) => (i === index ? cloudQuote : q))
      : [...quotes, cloudQuote];

  await set(QUOTES_KEY, updatedQuotes);
  return cloudQuote;
}

// Get quote by slug - try Supabase first (for public sharing), fallback to local
export async function getQuoteBySlug(slug: string): Promise<Quote | undefined> {
  // Try Supabase first (for shared links)
  const cloudQuote = await getQuoteBySlugFromSupabase(slug);
  if (cloudQuote) {
    return cloudQuote;
  }

  // Fallback to local
  const quotes = await getAllQuotes();
  return quotes.find((q) => q.slug === slug);
}

// Save NEW quote - local first, optionally sync to Supabase
export async function saveQuote(
  quote: Quote,
  options?: { localOnly?: boolean }
): Promise<{ synced: boolean }> {
  // 1. Save locally first (offline-first) — upsert by ID to prevent duplicates
  const quotes = await getAllQuotes();
  const updatedQuote = withRecalculatedTotals({ ...quote, updatedAt: new Date().toISOString() });
  const existingIndex = quotes.findIndex((q) => q.id === quote.id);
  const updatedQuotes =
    existingIndex >= 0
      ? quotes.map((q, i) => (i === existingIndex ? updatedQuote : q))
      : [...quotes, updatedQuote];
  await set(QUOTES_KEY, updatedQuotes);

  logAudit(
    existingIndex >= 0 ? "quote.updated" : "quote.created",
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
    // Server may have resolved a slug collision — update local copy if slug changed
    if (result.slug && result.slug !== updatedQuote.slug) {
      const currentQuotes = await getAllQuotes();
      await set(QUOTES_KEY, currentQuotes.map((q) =>
        q.id === updatedQuote.id ? { ...q, slug: result.slug! } : q
      ));
    }
  } else {
    await addToSyncQueue(updatedQuote.id);
  }

  return { synced: result.success };
}

// Update EXISTING quote - local first, then sync to Supabase
// Note: Only works for "draft" status quotes
export async function updateQuote(quote: Quote): Promise<{ synced: boolean; error?: string }> {
  // Check if quote is locked (sent/accepted)
  if (quote.status !== "draft") {
    return { synced: false, error: "Cannot edit sent quotes. Please duplicate instead." };
  }

  try {
    // 1. Update locally
    const quotes = await getAllQuotes();
    const existingIndex = quotes.findIndex((q) => q.id === quote.id);

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
    } else {
      console.warn("[updateQuote] Cloud sync failed (local save succeeded):", result.error);
      await addToSyncQueue(quote.id);
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
export async function markQuoteAsSent(quoteId: string): Promise<{ synced: boolean }> {
  const quotes = await getAllQuotes();
  const index = quotes.findIndex((q) => q.id === quoteId);

  if (index < 0) {
    return { synced: false };
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
  } else {
    await addToSyncQueue(quoteId);
  }

  // Pre-cache the public quote page for offline sharing
  if (updatedQuote.slug) {
    preCacheQuotePage(updatedQuote.slug);
  }

  logAudit("quote.sent", "quote", quoteId, updatedQuote.customerName);

  return { synced: result.success };
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

  // Create new quote with new ID, slug, and version tracking
  const newQuote: Quote = {
    ...original,
    id: crypto.randomUUID(),
    slug: await generateSlug(),
    parentId: rootParentId,  // Points to original quote (root of version chain)
    version: nextVersion,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save the duplicate
  await saveQuote(newQuote);

  logAudit("quote.duplicated", "quote", newQuote.id, `V${nextVersion} from ${quoteId}`);

  return newQuote;
}

// Delete quote - local and Supabase
export async function deleteQuote(id: string): Promise<{ cloudDeleted: boolean; error?: string }> {
  // Delete locally
  const quotes = await getAllQuotes();
  const deleted = quotes.find((q) => q.id === id);
  await set(QUOTES_KEY, quotes.filter((q) => q.id !== id));

  // Remove from sync queue (no point syncing a deleted quote)
  await removeFromSyncQueue(id);

  // Get device token and try to delete from Supabase
  const deviceToken = await getDeviceToken();
  const deleteResult = await deleteQuoteFromSupabase(id, deviceToken);

  if (deleteResult.success) {
    await removeFromDeleteQueue(id);
  } else {
    console.warn("[deleteQuote] Cloud deletion failed, queued for retry:", deleteResult.error);
    await addToDeleteQueue(id);
  }

  logAudit("quote.deleted", "quote", id, deleted?.customerName);

  return { cloudDeleted: deleteResult.success, error: deleteResult.error };
}

// Get recent quotes (local)
export async function getRecentQuotes(limit: number = 10): Promise<Quote[]> {
  const quotes = await getAllQuotes();
  return quotes
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

// Generate unique slug — checks local storage to avoid collisions
export async function generateSlug(): Promise<string> {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const quotes = await getAllQuotes();
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
