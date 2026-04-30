import { get, set } from "idb-keyval";
import type { Quote } from "@/types/quote";
import { fetchUserQuotesFromCloud } from "@/lib/supabase/quotes-api";
import { getSyncQueue } from "@/lib/storage/quotes";

const QUOTES_KEY = "ksq_quotes";

export interface HydrateResult {
  added: number;
  updated: number;
  kept: number;
  error: string | null;
}

// Merge rule for a cloud quote against a local one — same precedence as
// refreshQuoteFromCloud (lib/storage/quotes.ts):
//   1. Tombstoned local row → keep local (pending delete wins).
//   2. Local id is in the sync queue → keep local (offline edit not yet
//      uploaded; cloud snapshot is by definition stale, regardless of
//      updatedAt — clock skew / partial-sync states cannot be trusted).
//   3. Local updatedAt >= cloud updatedAt → keep local.
//   4. Otherwise cloud wins.
function pickWinner(
  local: Quote,
  cloud: Quote,
  pendingSyncIds: Set<string>
): Quote {
  if (local.deletedAt) return local;
  if (pendingSyncIds.has(local.id)) return local;
  if (new Date(local.updatedAt) >= new Date(cloud.updatedAt)) return local;
  return cloud;
}

// Pull all cloud quotes owned by the current user and merge them into IndexedDB.
// Safe to call multiple times — merge is idempotent under the rules above.
// Only writes back to IndexedDB when something actually changed.
export async function hydrateUserQuotesFromCloud(): Promise<HydrateResult> {
  const { quotes: cloudQuotes, error } = await fetchUserQuotesFromCloud();
  if (error) return { added: 0, updated: 0, kept: 0, error };

  const localRaw = (await get<Quote[]>(QUOTES_KEY)) || [];
  const byId = new Map<string, Quote>(localRaw.map((q) => [q.id, q]));
  const pendingSyncIds = new Set(await getSyncQueue());

  let added = 0;
  let updated = 0;
  let kept = 0;

  for (const cloud of cloudQuotes) {
    const local = byId.get(cloud.id);
    if (!local) {
      byId.set(cloud.id, cloud);
      added++;
      continue;
    }
    const winner = pickWinner(local, cloud, pendingSyncIds);
    if (winner === cloud) {
      byId.set(cloud.id, cloud);
      updated++;
    } else {
      kept++;
    }
  }

  // Skip the disk write when the merge was a no-op (typical on page reloads
  // where local already mirrors cloud).
  if (added > 0 || updated > 0) {
    await set(QUOTES_KEY, [...byId.values()]);
  }

  return { added, updated, kept, error: null };
}
