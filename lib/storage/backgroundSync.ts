import { syncPendingDeletions, syncPendingQuotes } from "./quotes";

export interface FlushResult {
  quotes: Awaited<ReturnType<typeof syncPendingQuotes>>;
  deletions: Awaited<ReturnType<typeof syncPendingDeletions>>;
}

// True when the flush actually pushed something to the cloud — callers use
// this to decide whether local lists need re-reading.
export function flushChangedAnything(result: FlushResult | null): boolean {
  if (!result) return false;
  return result.quotes.synced > 0 || result.deletions.deleted > 0;
}

// Flush both offline retry queues (failed quote syncs + failed deletions).
// Deletions run first so a queued delete isn't resurrected by a queued sync
// of the same id in a single pass.
//
// Cross-tab mutex via the Web Locks API so two open tabs don't double-POST
// the same queued rows; returns null when another tab holds the lock.
// Cheap no-op when both queues are empty (two IndexedDB reads).
export async function flushQuoteQueues(): Promise<FlushResult | null> {
  const run = async (): Promise<FlushResult> => {
    const deletions = await syncPendingDeletions();
    const quotes = await syncPendingQuotes();
    return { quotes, deletions };
  };

  if (typeof navigator !== "undefined" && "locks" in navigator) {
    const result = await navigator.locks.request(
      "ksq-quote-queue-flush",
      { ifAvailable: true },
      async (lock) => {
        if (!lock) return null;
        return run();
      }
    );
    return result;
  }

  return run();
}
