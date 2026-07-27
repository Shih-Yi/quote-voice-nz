"use client";

import { useEffect } from "react";
import {
  flushQuoteQueues,
  flushChangedAnything,
} from "@/lib/storage/backgroundSync";
import { emit, KSQ_EVENTS } from "@/lib/events";

// Re-check the queues once a minute. Retry backoff inside syncPendingQuotes /
// syncPendingDeletions grows 10s → 80s, so a minute keeps retries timely
// without hammering the API; the flush is a no-op when the queues are empty.
const FLUSH_INTERVAL_MS = 60_000;

// Drives the offline retry queues (failed quote syncs and deletions in
// lib/storage/quotes.ts). Runs a flush on app boot, whenever connectivity
// returns, and on a slow interval. Mounted once in Providers.
export function useBackgroundSync(): void {
  useEffect(() => {
    let cancelled = false;

    const flush = async () => {
      try {
        const result = await flushQuoteQueues();
        if (cancelled) return;
        if (flushChangedAnything(result)) {
          emit(KSQ_EVENTS.QUOTES_CHANGED);
        }
      } catch (err) {
        console.error("[useBackgroundSync] Queue flush failed:", err);
      }
    };

    flush();
    window.addEventListener("online", flush);
    const interval = setInterval(flush, FLUSH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("online", flush);
      clearInterval(interval);
    };
  }, []);
}
