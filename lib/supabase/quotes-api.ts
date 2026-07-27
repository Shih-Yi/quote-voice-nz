import type { Quote } from "@/types/quote";
import {
  fromSupabaseFormat,
  type SupabaseQuoteRow,
} from "@/lib/supabase/quotes";

export interface CloudWriteResult {
  success: boolean;
  error?: string;
  status?: number;
  /**
   * False when the server rejected the request in a way that will never
   * succeed on retry (bad payload, ownership mismatch, status conflict).
   * Callers use this to drop the item from the retry queue immediately
   * instead of burning the full backoff schedule on a doomed request.
   */
  retryable?: boolean;
  slug?: string;
  /** Authoritative updated_at from the DB row, echoed back by the server. */
  updatedAt?: string;
}

// Whether an HTTP failure is worth retrying. 5xx are server-side blips;
// 408 (request timeout) and 429 (rate limited) are transient by definition.
// Every other 4xx means the request itself is wrong and will stay wrong.
//
// `errorCode` disambiguates 429: burst rate limiting clears in seconds, but a
// plan quota being exhausted does not clear until the next billing month —
// retrying that on a backoff schedule would spin until it gave up anyway.
function isRetryableStatus(status: number, errorCode?: string): boolean {
  if (status === 429) {
    return errorCode !== "quota_exceeded" && errorCode !== "daily_quota_exceeded";
  }
  if (status === 408) return true;
  return status >= 500;
}

// Sync quote to Supabase via Next.js API route
export async function syncQuoteToSupabase(
  quote: Quote,
  deviceToken: string
): Promise<CloudWriteResult> {
  try {
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: quote.id,
        token: deviceToken,
        slug: quote.slug || quote.id.slice(0, 8),
        customerName: quote.customerName || "Draft",
        customerPhone: quote.customerPhone || null,
        customerEmail: quote.customerEmail || null,
        customerAddress: quote.customerAddress || null,
        providerDetails: quote.providerDetails || null,
        items: quote.items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        notes: quote.notes || null,
        gstInclusive: quote.gstInclusive,
        status: quote.status,
        parentId: quote.parentId || null,
        version: quote.version || 1,
        createdAt: quote.createdAt,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        success: false,
        error: body.error || `HTTP ${res.status}`,
        status: res.status,
        retryable: isRetryableStatus(res.status, body.error),
      };
    }

    const data = await res.json().catch(() => ({}));
    // Server may resolve slug collisions — return the final slug, plus the
    // row's authoritative updated_at so the local copy can match it.
    return { success: true, slug: data.slug, updatedAt: data.updatedAt };
  } catch (err) {
    // Network-level failure (offline, DNS, aborted) — always worth retrying.
    console.error("Supabase sync exception:", err);
    return { success: false, error: "Failed to sync to cloud", retryable: true };
  }
}

// Delete quote from Supabase via Next.js API route
export async function deleteQuoteFromSupabase(
  id: string,
  deviceToken: string
): Promise<CloudWriteResult> {
  try {
    const res = await fetch("/api/quotes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, token: deviceToken }),
    });

    // 404 means the row isn't in the cloud — which is exactly the end state
    // DELETE is asking for. Treating it as success keeps deletion idempotent
    // and stops never-synced quotes from being retried into the give-up path.
    if (res.status === 404) {
      return { success: true };
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        success: false,
        error: body.error || `HTTP ${res.status}`,
        status: res.status,
        retryable: isRetryableStatus(res.status, body.error),
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: "Failed to delete from cloud",
      retryable: true,
    };
  }
}

// Fetch all cloud quotes owned by the current authenticated user (by user_id).
// Used to rehydrate IndexedDB after login or on a fresh device.
export async function fetchUserQuotesFromCloud(): Promise<{
  quotes: Quote[];
  error: string | null;
}> {
  try {
    const res = await fetch("/api/quotes/mine", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { quotes: [], error: body.error || `HTTP ${res.status}` };
    }

    const data = await res.json();
    const rows: SupabaseQuoteRow[] = Array.isArray(data?.quotes)
      ? data.quotes
      : [];
    return { quotes: rows.map(fromSupabaseFormat), error: null };
  } catch (err) {
    console.error("Fetch user quotes exception:", err);
    return { quotes: [], error: "Failed to fetch user quotes" };
  }
}

// Bind all device quotes to user after registration/login via Next.js API route
export async function bindDeviceQuotesToUser(
  deviceToken: string,
  _userId: string
): Promise<{ count: number; error: string | null }> {
  try {
    const res = await fetch("/api/quotes/bind", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: deviceToken }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { count: 0, error: body.error || `HTTP ${res.status}` };
    }

    const data = await res.json();
    return { count: data.count || 0, error: null };
  } catch (err) {
    console.error("Bind quotes exception:", err);
    return { count: 0, error: "Failed to bind quotes" };
  }
}
