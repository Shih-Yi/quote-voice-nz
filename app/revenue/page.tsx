"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { MobileShell } from "@/components/layout/MobileShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getAllQuotes } from "@/lib/storage/quotes";
import { calculateRevenue, type RevenueOverview } from "@/lib/utils/revenue";
import { formatNZD } from "@/lib/utils/currency";
import { formatRelativeTime } from "@/lib/utils/date";

export default function RevenuePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [overview, setOverview] = useState<RevenueOverview | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const quotes = await getAllQuotes();
        setOverview(calculateRevenue(quotes));
      } catch (error) {
        console.error("Failed to load revenue data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // Find the max value for chart bar scaling
  const maxMonthlyTotal = useMemo(() => {
    if (!overview) return 1;
    return Math.max(...overview.monthlyStats.map((m) => m.total), 1);
  }, [overview]);

  if (isLoading) {
    return (
      <MobileShell>
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </MobileShell>
    );
  }

  if (!overview) {
    return (
      <MobileShell>
        <p className="text-center text-text-muted py-12">Failed to load data</p>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-text-muted hover:text-text">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-text">Revenue Dashboard</h1>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-text-muted">Total Quotes</p>
              <p className="text-2xl font-bold text-text">{overview.totalQuotes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-text-muted">Total Value</p>
              <p className="text-2xl font-bold text-text">{formatNZD(overview.totalValue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-text-muted">Accepted</p>
              <p className="text-2xl font-bold text-green-600">{formatNZD(overview.acceptedValue)}</p>
              <p className="text-xs text-text-muted">{overview.acceptedQuotes} quotes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4">
              <p className="text-xs text-text-muted">Conversion Rate</p>
              <p className="text-2xl font-bold text-primary">{overview.conversionRate.toFixed(0)}%</p>
              <p className="text-xs text-text-muted">Avg: {formatNZD(overview.averageQuoteValue)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Status Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-text-muted">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {[
                { label: "Drafts", count: overview.draftQuotes, colour: "bg-amber-400" },
                { label: "Sent", count: overview.sentQuotes, colour: "bg-blue-400" },
                { label: "Accepted", count: overview.acceptedQuotes, colour: "bg-green-400" },
              ].map((s) => {
                const pct = overview.totalQuotes > 0 ? (s.count / overview.totalQuotes) * 100 : 0;
                return (
                  <div key={s.label} className="flex-1 text-center">
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-1">
                      <div className={`h-full ${s.colour} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs font-medium text-text">{s.count}</p>
                    <p className="text-[10px] text-text-muted">{s.label}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-text-muted">Monthly Revenue (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-32">
              {overview.monthlyStats.map((m) => {
                const height = maxMonthlyTotal > 0 ? (m.total / maxMonthlyTotal) * 100 : 0;
                const acceptedHeight = maxMonthlyTotal > 0 ? (m.acceptedTotal / maxMonthlyTotal) * 100 : 0;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <p className="text-[9px] text-text-muted">{formatNZD(m.total)}</p>
                    <div className="w-full flex flex-col justify-end h-20 relative">
                      {/* Total bar */}
                      <div
                        className="w-full bg-primary/20 rounded-t"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      >
                        {/* Accepted portion */}
                        <div
                          className="w-full bg-green-400 rounded-t absolute bottom-0"
                          style={{ height: `${acceptedHeight}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-[9px] text-text-muted">{m.label.split(" ")[0]}</p>
                    <p className="text-[8px] text-text-muted">{m.count} quotes</p>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 justify-center">
              <div className="flex items-center gap-1">
                <div className="w-3 h-2 bg-primary/20 rounded" />
                <span className="text-[10px] text-text-muted">Total</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-2 bg-green-400 rounded" />
                <span className="text-[10px] text-text-muted">Accepted</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Customers */}
        {overview.topCustomers.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-text-muted">Top Customers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {overview.topCustomers.map((c, i) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-text-muted w-4 text-right">{i + 1}.</span>
                      <span className="text-sm font-medium text-text truncate">{c.name}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-text">{formatNZD(c.totalValue)}</p>
                      <p className="text-[10px] text-text-muted">
                        {c.quoteCount} {c.quoteCount === 1 ? "quote" : "quotes"} · {formatRelativeTime(c.lastQuoteDate)}
                      </p>
                    </div>
                  </div>
                  {i < overview.topCustomers.length - 1 && <Separator className="mt-2" />}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </MobileShell>
  );
}
