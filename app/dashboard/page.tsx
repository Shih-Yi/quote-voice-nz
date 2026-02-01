"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { MobileShell } from "@/components/layout/MobileShell";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getRecentQuotes } from "@/lib/storage/quotes";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
import { QuoteListItem } from "@/components/quote/QuoteListItem";
import { groupQuotesByVersion, type QuoteGroup } from "@/lib/utils/quoteVersions";
import type { Quote } from "@/types/quote";

export default function Dashboard() {
  const [quoteGroups, setQuoteGroups] = useState<QuoteGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { pendingCount, isSyncing, syncAll, refreshPending } = useOfflineStorage();

  useEffect(() => {
    async function loadData() {
      try {
        // Get more quotes to properly group versions
        const quotes = await getRecentQuotes(20);
        const groups = groupQuotesByVersion(quotes);
        // Show only top 5 groups on dashboard
        setQuoteGroups(groups.slice(0, 5));
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleQuoteCreated = async () => {
    const quotes = await getRecentQuotes(20);
    const groups = groupQuotesByVersion(quotes);
    setQuoteGroups(groups.slice(0, 5));
    await refreshPending();
  };

  const handleSync = async () => {
    toast.info("Syncing pending quotes...");
    await syncAll();
    const quotes = await getRecentQuotes(20);
    const groups = groupQuotesByVersion(quotes);
    setQuoteGroups(groups.slice(0, 5));
    toast.success("Sync complete!");
  };

  return (
    <MobileShell pendingCount={pendingCount}>
      <div className="flex flex-col gap-6">
        {/* Hero Section */}
        <div className="text-center pt-4">
          <h1 className="text-2xl font-bold text-text">
            Create a Quote
          </h1>
          <p className="text-text-muted mt-1">
            Tap to record your quote details
          </p>
        </div>

        {/* Voice Recorder */}
        <Card>
          <CardContent className="p-0">
            <VoiceRecorder onQuoteCreated={handleQuoteCreated} />
          </CardContent>
        </Card>

        {/* Recent Quotes */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-text">Recent Quotes</h2>
            {quoteGroups.length > 0 && (
              <Link href="/quotes" className="text-sm text-primary hover:text-primary-dark">
                View all
              </Link>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : quoteGroups.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-text-muted">No quotes yet</p>
                <p className="text-sm text-text-muted mt-1">
                  Record your first quote to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {quoteGroups.map((group) => (
                <QuoteListItem
                  key={group.latest.id}
                  quote={group.latest}
                  olderVersions={group.olderVersions}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sync Button */}
        {pendingCount > 0 && (
          <Button
            variant="outline"
            className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={handleSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <div className="w-4 h-4 mr-2 border-2 border-amber-700/30 border-t-amber-700 rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {isSyncing ? "Syncing..." : `Sync ${pendingCount} Pending ${pendingCount === 1 ? "Quote" : "Quotes"}`}
          </Button>
        )}
      </div>
    </MobileShell>
  );
}
