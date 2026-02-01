"use client";

import { useState, useEffect, useCallback } from "react";
import { getPendingAudio, removePendingAudio } from "@/lib/storage/pending";
import { saveQuote, generateSlug } from "@/lib/storage/quotes";
import { calculateQuoteTotals } from "@/lib/utils/gst";
import { v4 as uuidv4 } from "uuid";
import type { Quote, PendingAudio, ExtractionResult } from "@/types/quote";

interface UseOfflineStorageResult {
  pendingCount: number;
  isSyncing: boolean;
  syncAll: () => Promise<void>;
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

  const syncSingle = useCallback(async (item: PendingAudio): Promise<boolean> => {
    try {
      const formData = new FormData();
      formData.append("audio", item.blob, "recording.webm");

      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!transcribeRes.ok) {
        throw new Error("Transcription failed");
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
        throw new Error("Extraction failed");
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

      await saveQuote(quote);
      await removePendingAudio(item.id);

      return true;
    } catch {
      return false;
    }
  }, []);

  const syncAll = useCallback(async () => {
    setIsSyncing(true);

    try {
      const pending = await getPendingAudio();
      let successCount = 0;

      for (const item of pending) {
        const success = await syncSingle(item);
        if (success) {
          successCount++;
        }
      }

      await refreshPending();

      if (successCount > 0) {
        console.log(`Synced ${successCount} of ${pending.length} items`);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [syncSingle, refreshPending]);

  return {
    pendingCount,
    isSyncing,
    syncAll,
    refreshPending,
  };
}
