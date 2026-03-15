import { parseISO, startOfMonth, format, subMonths } from "date-fns";
import type { Quote } from "@/types/quote";

export interface MonthlyStats {
  month: string; // "MM/YYYY"
  label: string; // "Jan 2026"
  count: number;
  total: number;
  accepted: number;
  acceptedTotal: number;
}

export interface CustomerStats {
  name: string;
  quoteCount: number;
  totalValue: number;
  lastQuoteDate: string;
}

export interface RevenueOverview {
  totalQuotes: number;
  totalValue: number;
  acceptedQuotes: number;
  acceptedValue: number;
  sentQuotes: number;
  draftQuotes: number;
  conversionRate: number; // accepted / (accepted + sent) as percentage
  averageQuoteValue: number;
  monthlyStats: MonthlyStats[];
  topCustomers: CustomerStats[];
}

export function calculateRevenue(quotes: Quote[], monthsBack: number = 6): RevenueOverview {
  const now = new Date();
  const cutoff = subMonths(startOfMonth(now), monthsBack - 1);

  // Basic counts
  const totalQuotes = quotes.length;
  const totalValue = quotes.reduce((sum, q) => sum + q.total, 0);
  const acceptedQuotes = quotes.filter((q) => q.status === "accepted");
  const sentQuotes = quotes.filter((q) => q.status === "sent");
  const draftQuotes = quotes.filter((q) => q.status === "draft");

  const acceptedValue = acceptedQuotes.reduce((sum, q) => sum + q.total, 0);
  const nonDraftCount = acceptedQuotes.length + sentQuotes.length;
  const conversionRate = nonDraftCount > 0 ? (acceptedQuotes.length / nonDraftCount) * 100 : 0;
  const averageQuoteValue = totalQuotes > 0 ? totalValue / totalQuotes : 0;

  // Monthly breakdown
  const monthMap = new Map<string, MonthlyStats>();

  // Pre-populate months
  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthDate = subMonths(startOfMonth(now), i);
    const key = format(monthDate, "MM/yyyy");
    monthMap.set(key, {
      month: key,
      label: format(monthDate, "MMM yyyy"),
      count: 0,
      total: 0,
      accepted: 0,
      acceptedTotal: 0,
    });
  }

  for (const q of quotes) {
    const date = parseISO(q.createdAt);
    if (date < cutoff) continue;

    const key = format(startOfMonth(date), "MM/yyyy");
    const stats = monthMap.get(key);
    if (stats) {
      stats.count++;
      stats.total += q.total;
      if (q.status === "accepted") {
        stats.accepted++;
        stats.acceptedTotal += q.total;
      }
    }
  }

  const monthlyStats = Array.from(monthMap.values());

  // Top customers
  const customerMap = new Map<string, CustomerStats>();
  for (const q of quotes) {
    const name = q.customerName.trim();
    if (!name) continue;

    const existing = customerMap.get(name);
    if (existing) {
      existing.quoteCount++;
      existing.totalValue += q.total;
      if (q.createdAt > existing.lastQuoteDate) {
        existing.lastQuoteDate = q.createdAt;
      }
    } else {
      customerMap.set(name, {
        name,
        quoteCount: 1,
        totalValue: q.total,
        lastQuoteDate: q.createdAt,
      });
    }
  }

  const topCustomers = Array.from(customerMap.values())
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 10);

  return {
    totalQuotes,
    totalValue,
    acceptedQuotes: acceptedQuotes.length,
    acceptedValue,
    sentQuotes: sentQuotes.length,
    draftQuotes: draftQuotes.length,
    conversionRate,
    averageQuoteValue,
    monthlyStats,
    topCustomers,
  };
}
