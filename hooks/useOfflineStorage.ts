"use client";

import { useState, useEffect, useCallback } from "react";
import { getPendingAudio, removePendingAudio } from "@/lib/storage/pending";
import { saveQuote, generateSlug } from "@/lib/storage/quotes";
import { getDeviceToken } from "@/lib/storage/deviceToken";
import { emit, KSQ_EVENTS } from "@/lib/events";
import { calculateQuoteTotals } from "@/lib/utils/gst";
import { v4 as uuidv4 } from "uuid";
import type { Quote, PendingAudio, ExtractionResult } from "@/types/quote";

// Errors that won't succeed on retry — the audio itself is the problem
const UNRECOVERABLE_ERRORS = [
  "Text too short",
  "No speech detected",
  "No audio file provided",
];

function isUnrecoverable(error: string): boolean {
  return UNRECOVERABLE_ERRORS.some((e) => error.includes(e));
}

interface SyncResult {
  successCount: number;
  failCount: number;
  unrecoverableIds: string[];
  lastError?: string;
}

interface UseOfflineStorageResult {
  pendingCount: number;
  isSyncing: boolean;
  syncAll: () => Promise<SyncResult>;
  discardPendingByIds: (ids: string[]) => Promise<void>;
  refreshPending: () => Promise<void>;
}

export function useOfflineStorage(): UseOfflineStorageResult {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshPending = useCallback(async () => {
    const pending = await getPendingAudio();
    setPendingCount(pending.length);
  }, []);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  const syncSingle = useCallback(async (item: PendingAudio): Promise<{ success: boolean; error?: string }> => {
    try {
      const formData = new FormData();
      formData.append("audio", item.blob, "recording.webm");

      const deviceToken = await getDeviceToken();
      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "x-device-token": deviceToken },
        body: formData,
      });

      if (!transcribeRes.ok) {
        const errBody = await transcribeRes.json().catch(() => ({}));
        if (errBody?.action === "login_required") {
          emit(KSQ_EVENTS.AUTH_REQUIRED, { reason: "anon_quota_exceeded" });
          throw new Error("login_required");
        }
        throw new Error(errBody.error || `Transcription failed (${transcribeRes.status})`);
      }

      const { text } = await transcribeRes.json();

      if (!text || text.trim().length === 0) {
        throw new Error("No speech detected");
      }

      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!extractRes.ok) {
        const errBody = await extractRes.json().catch(() => ({}));
        throw new Error(errBody.error || `Extraction failed (${extractRes.status})`);
      }

      const extraction: ExtractionResult = await extractRes.json();

      const quoteId = uuidv4();
      const slug = await generateSlug();

      const items = extraction.items.map((i) => ({
        id: uuidv4(),
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.quantity * i.unitPrice,
      }));

      const { subtotal, gst, total } = calculateQuoteTotals(items, false);

      const quote: Quote = {
        id: quoteId,
        customerName: extraction.customerName || "Customer",
        customerPhone: extraction.customerPhone ?? undefined,
        customerEmail: extraction.customerEmail ?? undefined,
        customerAddress: extraction.customerAddress ?? undefined,
        items,
        notes: extraction.notes ?? undefined,
        gstInclusive: false,
        subtotal,
        gst,
        total,
        status: "draft",
        createdAt: item.createdAt,
        updatedAt: new Date().toISOString(),
        slug,
      };

      await saveQuote(quote, { localOnly: true });
      await removePendingAudio(item.id);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (isUnrecoverable(message)) {
        console.warn(`[Sync] Skipping item ${item.id} — unrecoverable: ${message}`);
      } else {
        console.error(`[Sync] Failed to sync item ${item.id}:`, message);
      }
      return { success: false, error: message };
    }
  }, []);

  const syncAll = useCallback(async (): Promise<SyncResult> => {
    setIsSyncing(true);

    try {
      const pending = await getPendingAudio();
      let successCount = 0;
      const unrecoverableIds: string[] = [];
      let lastError: string | undefined;

      for (const item of pending) {
        const result = await syncSingle(item);
        if (result.success) {
          successCount++;
        } else if (result.error && isUnrecoverable(result.error)) {
          unrecoverableIds.push(item.id);
        } else if (result.error === "login_required") {
          // Quota gate hit — no point retrying the rest on this pass. Items
          // remain queued and will replay after sign-in.
          lastError = "login_required";
          break;
        } else {
          lastError = result.error;
        }
      }

      await refreshPending();

      const failCount = pending.length - successCount - unrecoverableIds.length;
      return { successCount, failCount, unrecoverableIds, lastError };
    } finally {
      setIsSyncing(false);
    }
  }, [syncSingle, refreshPending]);

  const discardPendingByIds = useCallback(async (ids: string[]) => {
    for (const id of ids) {
      await removePendingAudio(id);
    }
    await refreshPending();
  }, [refreshPending]);

  return {
    pendingCount,
    isSyncing,
    syncAll,
    discardPendingByIds,
    refreshPending,
  };
}
