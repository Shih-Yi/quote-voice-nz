"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getAllQuotes,
  getQuoteById,
  saveQuote,
  deleteQuote,
  getRecentQuotes,
} from "@/lib/storage/quotes";
import type { Quote } from "@/types/quote";

interface UseQuotesResult {
  quotes: Quote[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  getById: (id: string) => Promise<Quote | undefined>;
  save: (quote: Quote) => Promise<{ synced: boolean; syncError?: string; slug?: string }>;
  remove: (id: string) => Promise<void>;
}

export function useQuotes(limit?: number): UseQuotesResult {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = limit
        ? await getRecentQuotes(limit)
        : await getAllQuotes();
      setQuotes(
        data.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load quotes"));
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getById = useCallback(async (id: string) => {
    return getQuoteById(id);
  }, []);

  const save = useCallback(
    async (quote: Quote) => {
      const result = await saveQuote(quote);
      await refresh();
      return result;
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteQuote(id);
      await refresh();
    },
    [refresh]
  );

  return {
    quotes,
    isLoading,
    error,
    refresh,
    getById,
    save,
    remove,
  };
}
