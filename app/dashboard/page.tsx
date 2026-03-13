"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { MobileShell } from "@/components/layout/MobileShell";
import { VoiceRecorder } from "@/components/voice/VoiceRecorder";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { getRecentQuotes, saveQuote, generateSlug } from "@/lib/storage/quotes";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
import { QuoteListItem } from "@/components/quote/QuoteListItem";
import { groupQuotesByVersion, type QuoteGroup } from "@/lib/utils/quoteVersions";
import type { Quote } from "@/types/quote";

export default function Dashboard() {
  const router = useRouter();
  const [quoteGroups, setQuoteGroups] = useState<QuoteGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failedIds, setFailedIds] = useState<string[]>([]);
  const { pendingCount, isSyncing, syncAll, discardPendingByIds, refreshPending } = useOfflineStorage();

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
    const { successCount, failCount, unrecoverableIds, lastError } = await syncAll();

    const quotes = await getRecentQuotes(20);
    const groups = groupQuotesByVersion(quotes);
    setQuoteGroups(groups.slice(0, 5));

    // Show dialog for unrecoverable items (no speech / too short)
    if (unrecoverableIds.length > 0) {
      setFailedIds(unrecoverableIds);
    }

    if (successCount > 0) {
      toast.success(`Synced ${successCount} ${successCount === 1 ? "quote" : "quotes"} successfully!`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} failed: ${lastError || "Unknown error"}`);
    }
  };

  const handleCreateEmptyDrafts = async () => {
    const idsToProcess = [...failedIds];
    let lastCreatedId: string | undefined;

    for (const _pendingId of idsToProcess) {
      const quoteId = uuidv4();
      const slug = await generateSlug();
      const quote: Quote = {
        id: quoteId,
        customerName: "Customer",
        items: [],
        gstInclusive: false,
        subtotal: 0,
        gst: 0,
        total: 0,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        slug,
      };
      await saveQuote(quote);
      lastCreatedId = quoteId;
    }

    await discardPendingByIds(idsToProcess);
    setFailedIds([]);

    const quotes = await getRecentQuotes(20);
    const groups = groupQuotesByVersion(quotes);
    setQuoteGroups(groups.slice(0, 5));

    if (idsToProcess.length === 1 && lastCreatedId) {
      // Single item — go straight to edit
      router.push(`/quote/${lastCreatedId}`);
    } else {
      toast.success(`Created ${idsToProcess.length} empty drafts. Tap to edit.`);
    }
  };

  const handleDiscardFailed = async () => {
    await discardPendingByIds(failedIds);
    setFailedIds([]);
    toast.success("Discarded.");
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
            <div className="flex items-center gap-3">
              {quoteGroups.length > 0 && (
                <Link href="/revenue" className="text-sm text-secondary hover:text-secondary/80">
                  Revenue
                </Link>
              )}
              {quoteGroups.length > 0 && (
                <Link href="/quotes" className="text-sm text-primary hover:text-primary-dark">
                  View all
                </Link>
              )}
            </div>
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

      {/* Failed Sync Dialog */}
      <Dialog open={failedIds.length > 0} onOpenChange={(open) => !open && setFailedIds([])}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {failedIds.length === 1
                ? "Recording has no speech"
                : `${failedIds.length} recordings have no speech`}
            </DialogTitle>
            <DialogDescription>
              {failedIds.length === 1
                ? "This recording was too short or had no detectable speech. Would you like to create an empty draft to fill in manually?"
                : `These ${failedIds.length} recordings were too short or had no detectable speech. Would you like to create empty drafts to fill in manually?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={handleCreateEmptyDrafts} className="w-full">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {failedIds.length === 1 ? "Create Empty Draft" : `Create ${failedIds.length} Empty Drafts`}
            </Button>
            <Button
              variant="outline"
              onClick={handleDiscardFailed}
              className="w-full text-red-500 border-red-200 hover:bg-red-50"
            >
              Discard {failedIds.length === 1 ? "Recording" : "Recordings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MobileShell>
  );
}
