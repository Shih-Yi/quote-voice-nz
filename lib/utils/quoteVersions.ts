import type { Quote } from "@/types/quote";

export interface QuoteGroup {
  latest: Quote;
  olderVersions: Quote[];
}

/**
 * Groups quotes by their version chain.
 * Returns groups sorted by the latest quote's updatedAt time.
 *
 * Logic:
 * - Quotes with same parentId belong to same group
 * - Quote without parentId is either a root quote or standalone
 * - Root quote's id is used as the group key
 */
export function groupQuotesByVersion(quotes: Quote[]): QuoteGroup[] {
  // Map: rootId -> all quotes in chain
  const groupMap = new Map<string, Quote[]>();

  for (const quote of quotes) {
    // Determine the root ID (group key)
    // If quote has parentId, use that; otherwise use its own id
    const rootId = quote.parentId || quote.id;

    if (!groupMap.has(rootId)) {
      groupMap.set(rootId, []);
    }
    groupMap.get(rootId)!.push(quote);
  }

  // Convert to QuoteGroup array
  const groups: QuoteGroup[] = [];

  for (const [, groupQuotes] of groupMap) {
    // Sort by version descending (latest first)
    groupQuotes.sort((a, b) => (b.version || 1) - (a.version || 1));

    const [latest, ...olderVersions] = groupQuotes;
    groups.push({
      latest,
      olderVersions,
    });
  }

  // Sort groups by latest quote's updatedAt (most recent first)
  groups.sort((a, b) =>
    new Date(b.latest.updatedAt).getTime() - new Date(a.latest.updatedAt).getTime()
  );

  return groups;
}

/**
 * Get version history for a specific quote.
 * Returns all quotes in the same version chain, sorted by version.
 */
export function getVersionHistory(quotes: Quote[], quoteId: string): Quote[] {
  const targetQuote = quotes.find(q => q.id === quoteId);
  if (!targetQuote) return [];

  const rootId = targetQuote.parentId || targetQuote.id;

  return quotes
    .filter(q => q.id === rootId || q.parentId === rootId)
    .sort((a, b) => (b.version || 1) - (a.version || 1));
}
