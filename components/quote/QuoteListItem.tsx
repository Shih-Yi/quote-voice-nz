"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNZD } from "@/lib/utils/currency";
import { formatRelativeTime } from "@/lib/utils/date";
import type { Quote } from "@/types/quote";

interface QuoteListItemProps {
  quote: Quote;
  olderVersions?: Quote[];
}

const statusColors: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
};

export function QuoteListItem({ quote, olderVersions = [] }: QuoteListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasVersions = olderVersions.length > 0;
  const showVersionBadge = (quote.version && quote.version > 1) || hasVersions;

  return (
    <div className="space-y-0">
      {/* Main Quote Card (Latest Version) */}
      <Link href={`/quote/${quote.id}`}>
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-text truncate">
                    {quote.customerName}
                  </p>
                  {/* Version Badge */}
                  {showVersionBadge && (
                    <Badge
                      variant="outline"
                      className="text-xs border-slate-300 text-slate-500"
                    >
                      V{quote.version || 1}
                    </Badge>
                  )}
                  {/* Status Badge */}
                  <Badge
                    variant="secondary"
                    className={`text-xs ${statusColors[quote.status]}`}
                  >
                    {quote.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm text-text-muted">
                    {formatRelativeTime(quote.updatedAt)}
                  </p>
                  {/* Expand Toggle for Versions */}
                  {hasVersions && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                      }}
                      className="text-xs text-primary hover:text-primary-dark flex items-center gap-1"
                    >
                      <svg
                        className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      {olderVersions.length} earlier {olderVersions.length === 1 ? "version" : "versions"}
                    </button>
                  )}
                </div>
              </div>
              <span className="font-semibold text-text">
                {formatNZD(quote.total)}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Older Versions (Collapsible) */}
      {hasVersions && isExpanded && (
        <div className="ml-4 border-l-2 border-slate-200 pl-3 space-y-1 py-1">
          {olderVersions.map((oldQuote) => (
            <Link key={oldQuote.id} href={`/quote/${oldQuote.id}`}>
              <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  {/* Version indicator */}
                  <span className="text-xs text-slate-400 font-medium">
                    V{oldQuote.version || 1}
                  </span>
                  {/* Status */}
                  <Badge
                    variant="secondary"
                    className={`text-xs ${statusColors[oldQuote.status]} opacity-75`}
                  >
                    {oldQuote.status}
                  </Badge>
                  {/* Time */}
                  <span className="text-xs text-text-muted">
                    {formatRelativeTime(oldQuote.updatedAt)}
                  </span>
                </div>
                <span className="text-sm text-text-muted">
                  {formatNZD(oldQuote.total)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
