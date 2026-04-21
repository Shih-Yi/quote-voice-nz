import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Simple idempotency helper.
//
// Given a key, returns true when this is the FIRST call within the TTL window.
// Subsequent calls with the same key within the window return false — callers
// should treat those as "already handled, skip the work" and respond as if it
// succeeded.
//
// Uses Upstash Redis (SET NX EX) when configured so it works across serverless
// instances. Falls back to a per-process Map for local dev.
// ---------------------------------------------------------------------------

interface MemoryEntry {
  expiresAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();
let lastCleanup = Date.now();

function cleanupMemory() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt <= now) memoryStore.delete(key);
  }
}

let cachedRedis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    cachedRedis = null;
    return null;
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

/**
 * Attempt to claim an idempotency slot.
 *
 * @returns true  — caller is the first to claim the key, should do the work
 * @returns false — key was already claimed within TTL, caller should skip
 */
export async function claimIdempotencyKey(
  key: string,
  ttlSeconds: number
): Promise<boolean> {
  const redis = getRedis();
  const fullKey = `ksq:idem:${key}`;

  if (redis) {
    // SET NX EX — atomic "set if not exists with TTL"
    const result = await redis.set(fullKey, "1", { nx: true, ex: ttlSeconds });
    return result === "OK";
  }

  cleanupMemory();
  const now = Date.now();
  const existing = memoryStore.get(fullKey);
  if (existing && existing.expiresAt > now) return false;
  memoryStore.set(fullKey, { expiresAt: now + ttlSeconds * 1000 });
  return true;
}

export const __testing = {
  clearMemory: () => memoryStore.clear(),
  resetRedisCache: () => {
    cachedRedis = undefined;
  },
};
