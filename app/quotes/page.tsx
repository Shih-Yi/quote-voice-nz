"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAllQuotes } from "@/lib/storage/quotes";
import { formatNZD } from "@/lib/utils/currency";
import { formatNZDate } from "@/lib/utils/date";
import type { Quote } from "@/types/quote";

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "draft" | "sent" | "accepted">("all");

  useEffect(() => {
    async function loadQuotes() {
      try {
        const data = await getAllQuotes();
        setQuotes(data.sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ));
      } catch (error) {
        console.error("Failed to load quotes:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadQuotes();
  }, []);

  const filteredQuotes = filter === "all"
    ? quotes
    : quotes.filter((q) => q.status === filter);

  const statusColors = {
    draft: "bg-amber-100 text-amber-800",
    sent: "bg-blue-100 text-blue-800",
    accepted: "bg-green-100 text-green-800",
  };

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
            <Link href="/" className="text-text-muted hover:text-text">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-text">All Quotes</h1>
          </div>
          <span className="text-text-muted text-sm">
            {filteredQuotes.length} {filteredQuotes.length === 1 ? "quote" : "quotes"}
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
        ) : filteredQuotes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-text-muted">
                {filter === "all" ? "No quotes yet" : `No ${filter} quotes`}
              </p>
              {filter === "all" && (
                <Link href="/" className="mt-4 inline-block">
                  <Button className="bg-primary hover:bg-primary-dark">
                    Create Your First Quote
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredQuotes.map((quote) => (
              <Link key={quote.id} href={`/quote/${quote.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-text truncate">
                            {quote.customerName}
                          </p>
                          <Badge
                            variant="secondary"
                            className={`text-xs shrink-0 ${statusColors[quote.status]}`}
                          >
                            {quote.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-text-muted">
                          {formatNZDate(quote.createdAt)}
                        </p>
                        {quote.items.length > 0 && (
                          <p className="text-sm text-text-muted truncate mt-1">
                            {quote.items.length} item{quote.items.length !== 1 ? "s" : ""}
                            {quote.items[0] && ` - ${quote.items[0].description}`}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-semibold text-text">
                          {formatNZD(quote.total)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
