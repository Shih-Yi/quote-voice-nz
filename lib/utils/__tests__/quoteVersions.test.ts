import { describe, it, expect } from "vitest";
import { groupQuotesByVersion, getVersionHistory } from "../quoteVersions";
import type { Quote } from "@/types/quote";

function makeQuote(overrides: Partial<Quote>): Quote {
  return {
    id: "q1",
    customerName: "Test Customer",
    items: [],
    gstInclusive: false,
    subtotal: 0,
    gst: 0,
    total: 0,
    status: "draft",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("groupQuotesByVersion", () => {
  it("groups standalone quotes individually", () => {
    const quotes = [
      makeQuote({ id: "a", updatedAt: "2026-01-02T00:00:00Z" }),
      makeQuote({ id: "b", updatedAt: "2026-01-01T00:00:00Z" }),
    ];

    const groups = groupQuotesByVersion(quotes);
    expect(groups).toHaveLength(2);
    expect(groups[0].latest.id).toBe("a"); // most recent first
    expect(groups[1].latest.id).toBe("b");
  });

  it("groups versioned quotes together", () => {
    const quotes = [
      makeQuote({ id: "root", version: 1, updatedAt: "2026-01-01T00:00:00Z" }),
      makeQuote({ id: "v2", parentId: "root", version: 2, updatedAt: "2026-01-02T00:00:00Z" }),
      makeQuote({ id: "v3", parentId: "root", version: 3, updatedAt: "2026-01-03T00:00:00Z" }),
    ];

    const groups = groupQuotesByVersion(quotes);
    expect(groups).toHaveLength(1);
    expect(groups[0].latest.id).toBe("v3");
    expect(groups[0].olderVersions).toHaveLength(2);
    expect(groups[0].olderVersions[0].id).toBe("v2");
    expect(groups[0].olderVersions[1].id).toBe("root");
  });

  it("returns empty array for empty input", () => {
    expect(groupQuotesByVersion([])).toEqual([]);
  });

  it("sorts groups by latest updatedAt descending", () => {
    const quotes = [
      makeQuote({ id: "old-root", updatedAt: "2026-01-01T00:00:00Z" }),
      makeQuote({ id: "new-root", updatedAt: "2026-01-05T00:00:00Z" }),
    ];

    const groups = groupQuotesByVersion(quotes);
    expect(groups[0].latest.id).toBe("new-root");
    expect(groups[1].latest.id).toBe("old-root");
  });
});

describe("getVersionHistory", () => {
  const quotes = [
    makeQuote({ id: "root", version: 1, updatedAt: "2026-01-01T00:00:00Z" }),
    makeQuote({ id: "v2", parentId: "root", version: 2, updatedAt: "2026-01-02T00:00:00Z" }),
    makeQuote({ id: "v3", parentId: "root", version: 3, updatedAt: "2026-01-03T00:00:00Z" }),
    makeQuote({ id: "unrelated", updatedAt: "2026-01-04T00:00:00Z" }),
  ];

  it("returns version history for root quote", () => {
    const history = getVersionHistory(quotes, "root");
    expect(history).toHaveLength(3);
    expect(history[0].id).toBe("v3"); // highest version first
    expect(history[2].id).toBe("root");
  });

  it("returns version history for child quote", () => {
    const history = getVersionHistory(quotes, "v2");
    expect(history).toHaveLength(3);
  });

  it("returns empty array for non-existent quote", () => {
    expect(getVersionHistory(quotes, "missing")).toEqual([]);
  });

  it("returns single-item array for standalone quote", () => {
    const history = getVersionHistory(quotes, "unrelated");
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("unrelated");
  });
});
