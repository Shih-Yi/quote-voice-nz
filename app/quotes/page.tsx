"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAllQuotes } from "@/lib/storage/quotes";
import { QuoteListItem } from "@/components/quote/QuoteListItem";
import { groupQuotesByVersion, type QuoteGroup } from "@/lib/utils/quoteVersions";
import type { Quote } from "@/types/quote";

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "draft" | "sent" | "accepted">("all");

  useEffect(() => {
    async function loadQuotes() {
      try {
        const data = await getAllQuotes();
        setQuotes(data);
      } catch (error) {
        console.error("Failed to load quotes:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadQuotes();
  }, []);

  // Group and filter quotes
  const filteredGroups = useMemo(() => {
    // First filter quotes
    const filteredQuotes = filter === "all"
      ? quotes
      : quotes.filter((q) => q.status === filter);

    // Then group them
    return groupQuotesByVersion(filteredQuotes);
  }, [quotes, filter]);

  // Count for display
  const totalCount = useMemo(() => {
    return filteredGroups.reduce(
      (sum, group) => sum + 1 + group.olderVersions.length,
      0
    );
  }, [filteredGroups]);

  const filters: { label: string; value: typeof filter }[] = [
    { label: "All", value: "all" },
    { label: "Drafts", value: "draft" },
    { label: "Sent", value: "sent" },
    { label: "Accepted", value: "accepted" },
  ];

  return (
    <MobileShell>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-text-muted hover:text-text">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-text">All Quotes</h1>
          </div>
          <span className="text-text-muted text-sm">
            {totalCount} {totalCount === 1 ? "quote" : "quotes"}
          </span>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {filters.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.value)}
              className={filter === f.value ? "bg-primary" : ""}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* Quote List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-text-muted">
                {filter === "all" ? "No quotes yet" : `No ${filter} quotes`}
              </p>
              {filter === "all" && (
                <Link href="/dashboard" className="mt-4 inline-block">
                  <Button className="bg-primary hover:bg-primary-dark">
                    Create Your First Quote
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredGroups.map((group) => (
              <QuoteListItem
                key={group.latest.id}
                quote={group.latest}
                olderVersions={group.olderVersions}
              />
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
