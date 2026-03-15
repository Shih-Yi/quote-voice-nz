import { describe, it, expect } from "vitest";
import { calculateRevenue } from "../revenue";
import type { Quote } from "@/types/quote";

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: crypto.randomUUID(),
    customerName: "Test Customer",
    items: [],
    gstInclusive: true,
    subtotal: 100,
    gst: 15,
    total: 115,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("calculateRevenue", () => {
  it("returns zero stats for empty quotes", () => {
    const result = calculateRevenue([]);
    expect(result.totalQuotes).toBe(0);
    expect(result.totalValue).toBe(0);
    expect(result.acceptedQuotes).toBe(0);
    expect(result.acceptedValue).toBe(0);
    expect(result.sentQuotes).toBe(0);
    expect(result.draftQuotes).toBe(0);
    expect(result.conversionRate).toBe(0);
    expect(result.averageQuoteValue).toBe(0);
  });

  it("counts quotes by status", () => {
    const quotes = [
      makeQuote({ status: "draft", total: 100 }),
      makeQuote({ status: "sent", total: 200 }),
      makeQuote({ status: "sent", total: 300 }),
      makeQuote({ status: "accepted", total: 400 }),
    ];

    const result = calculateRevenue(quotes);
    expect(result.totalQuotes).toBe(4);
    expect(result.draftQuotes).toBe(1);
    expect(result.sentQuotes).toBe(2);
    expect(result.acceptedQuotes).toBe(1);
  });

  it("calculates total value", () => {
    const quotes = [
      makeQuote({ total: 100 }),
      makeQuote({ total: 250.50 }),
    ];

    const result = calculateRevenue(quotes);
    expect(result.totalValue).toBe(350.50);
  });

  it("calculates accepted value", () => {
    const quotes = [
      makeQuote({ status: "accepted", total: 500 }),
      makeQuote({ status: "accepted", total: 300 }),
      makeQuote({ status: "sent", total: 200 }),
    ];

    const result = calculateRevenue(quotes);
    expect(result.acceptedValue).toBe(800);
  });

  it("calculates conversion rate", () => {
    const quotes = [
      makeQuote({ status: "accepted" }),
      makeQuote({ status: "sent" }),
      makeQuote({ status: "sent" }),
      makeQuote({ status: "sent" }),
    ];

    const result = calculateRevenue(quotes);
    // 1 accepted / (1 accepted + 3 sent) = 25%
    expect(result.conversionRate).toBe(25);
  });

  it("excludes drafts from conversion rate", () => {
    const quotes = [
      makeQuote({ status: "accepted" }),
      makeQuote({ status: "accepted" }),
      makeQuote({ status: "draft" }),
      makeQuote({ status: "draft" }),
    ];

    const result = calculateRevenue(quotes);
    // 2 accepted / (2 accepted + 0 sent) = 100%
    expect(result.conversionRate).toBe(100);
  });

  it("calculates average quote value", () => {
    const quotes = [
      makeQuote({ total: 100 }),
      makeQuote({ total: 200 }),
      makeQuote({ total: 300 }),
    ];

    const result = calculateRevenue(quotes);
    expect(result.averageQuoteValue).toBe(200);
  });

  it("generates monthly stats for last 6 months", () => {
    const result = calculateRevenue([]);
    expect(result.monthlyStats).toHaveLength(6);
  });

  it("generates monthly stats for custom period", () => {
    const result = calculateRevenue([], 3);
    expect(result.monthlyStats).toHaveLength(3);
  });

  it("populates monthly stats with quote data", () => {
    const now = new Date();
    const quotes = [
      makeQuote({ total: 100, createdAt: now.toISOString() }),
      makeQuote({ total: 200, status: "accepted", createdAt: now.toISOString() }),
    ];

    const result = calculateRevenue(quotes);
    const currentMonth = result.monthlyStats[result.monthlyStats.length - 1];
    expect(currentMonth.count).toBe(2);
    expect(currentMonth.total).toBe(300);
    expect(currentMonth.accepted).toBe(1);
    expect(currentMonth.acceptedTotal).toBe(200);
  });

  it("builds top customers sorted by value", () => {
    const quotes = [
      makeQuote({ customerName: "Alice", total: 500 }),
      makeQuote({ customerName: "Bob", total: 300 }),
      makeQuote({ customerName: "Alice", total: 200 }),
    ];

    const result = calculateRevenue(quotes);
    expect(result.topCustomers).toHaveLength(2);
    expect(result.topCustomers[0].name).toBe("Alice");
    expect(result.topCustomers[0].totalValue).toBe(700);
    expect(result.topCustomers[0].quoteCount).toBe(2);
    expect(result.topCustomers[1].name).toBe("Bob");
    expect(result.topCustomers[1].totalValue).toBe(300);
  });

  it("limits top customers to 10", () => {
    const quotes = Array.from({ length: 15 }, (_, i) =>
      makeQuote({ customerName: `Customer ${i}`, total: 100 + i })
    );

    const result = calculateRevenue(quotes);
    expect(result.topCustomers).toHaveLength(10);
  });

  it("skips empty customer names", () => {
    const quotes = [
      makeQuote({ customerName: "", total: 100 }),
      makeQuote({ customerName: "Bob", total: 200 }),
    ];

    const result = calculateRevenue(quotes);
    expect(result.topCustomers).toHaveLength(1);
    expect(result.topCustomers[0].name).toBe("Bob");
  });
});
