import { getSupabase } from "./client";
import type { Quote, LineItem, UserProfile } from "@/types/quote";

export interface SupabaseQuoteRow {
  id: string;
  slug: string;
  owner_token_hash: string;
  user_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  provider_details: UserProfile | null;
  items: SupabaseQuoteItem[];
  notes: string | null;
  gst_inclusive: boolean;
  items_sum: number;
  subtotal: number;
  gst: number;
  total: number;
  status: string;
  parent_id: string | null;    // Version tracking
  version: number;             // Version number
  created_at: string;
  updated_at: string;
  // Joined owner profile fields (only present on get_quote_by_slug RPC rows).
  // owner_bank_account is deliberately absent — migration 018 removed it from
  // the public RPC. Bank details reach the customer only when the tradie put
  // them on that specific quote via provider_details.
  owner_business_name?: string | null;
  owner_phone?: string | null;
  owner_email?: string | null;
  owner_address?: string | null;
  owner_subscription_tier?: string | null;
}

interface SupabaseQuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export type OwnerTier = "free" | "pro" | "team";

interface OwnerProfileResult {
  profile: UserProfile | undefined;
  /** Defaults to "free" when absent or unrecognised — never fail open to a
   *  paid tier on the strength of an unexpected DB value. */
  tier: OwnerTier;
}

function normaliseTier(value: string | null | undefined): OwnerTier {
  return value === "pro" || value === "team" ? value : "free";
}

// Extract owner profile/tier from a JOINed RPC row (no extra round trip)
function extractOwnerFromRow(row: SupabaseQuoteRow): OwnerProfileResult {
  if (!row.user_id) return { profile: undefined, tier: "free" };

  const hasAny =
    row.owner_business_name ||
    row.owner_phone ||
    row.owner_email ||
    row.owner_address;

  // No bankAccount here by design — the public RPC no longer returns it.
  const profile: UserProfile | undefined = hasAny
    ? {
        id: row.user_id,
        businessName: row.owner_business_name ?? undefined,
        phone: row.owner_phone ?? undefined,
        email: row.owner_email ?? undefined,
        address: row.owner_address ?? undefined,
      }
    : undefined;

  return { profile, tier: normaliseTier(row.owner_subscription_tier) };
}

// Fallback fetch for code paths that don't JOIN profiles (e.g. direct table SELECT)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchOwnerProfile(supabase: any, userId: string | null): Promise<OwnerProfileResult> {
  if (!userId) return { profile: undefined, tier: "free" };

  try {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      return {
        profile: {
          id: data.id,
          businessName: data.business_name,
          phone: data.phone,
          email: data.email,
          address: data.address,
          bankAccount: data.bank_account,
        },
        tier: normaliseTier(data.subscription_tier),
      };
    }
  } catch {
    // Ignore errors, profile might not exist
  }
  return { profile: undefined, tier: "free" };
}


// Convert Supabase format to local Quote
export function fromSupabaseFormat(row: SupabaseQuoteRow): Quote {
  return {
    id: row.id,
    slug: row.slug,
    userId: row.user_id || undefined,
    parentId: row.parent_id ?? undefined,   // Version tracking
    version: row.version || 1,               // Default to V1
    customerName: row.customer_name,
    customerPhone: row.customer_phone ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    customerAddress: row.customer_address ?? undefined,
    providerDetails: row.provider_details || undefined,
    items: (row.items || []).map((item): LineItem => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      total: item.total,
    })),
    notes: row.notes ?? undefined,
    gstInclusive: row.gst_inclusive,
    subtotal: Number(row.subtotal),
    gst: Number(row.gst),
    total: Number(row.total),
    status: row.status as "draft" | "sent" | "accepted",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // The row came from Supabase, so by definition the cloud has it. Keeps
    // deleteQuote from mistaking a hydrated quote for a never-uploaded one.
    cloudSyncedAt: row.updated_at,
  };
}

// Get quote by slug (public - for shared links, uses RPC)
export async function getQuoteBySlugFromSupabase(slug: string): Promise<Quote | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc("get_quote_by_slug", {
      p_slug: slug,
    });

    if (error || !data || data.length === 0) {
      return null;
    }

    const row = data[0] as SupabaseQuoteRow;
    const quote = fromSupabaseFormat(row);
    const { profile, tier } = extractOwnerFromRow(row);
    quote.ownerProfile = profile;
    // Creator's plan. Anonymous quotes count as free. The public page uses this
    // to decide whether online acceptance is available, so that a free-tier
    // limitation never surfaces as a paywall in front of the customer.
    quote.ownerTier = tier;
    // Show watermark when creator is on free tier (or no user = anonymous)
    quote.showWatermark = !quote.userId || tier === "free";

    return quote;
  } catch {
    return null;
  }
}

// Get quote by ID — direct table SELECT under RLS.
//
// Migration 014 restricts SELECT on api.quotes to `authenticated` rows where
// user_id = auth.uid(); the anon role has no SELECT policy at all. So this
// only ever returns data for a signed-in owner. We check the session up front
// rather than firing a request that is guaranteed to come back empty —
// anonymous users simply have no cloud refresh path (public sharing goes
// through the get_quote_by_slug RPC instead).
export async function getQuoteByIdFromSupabase(id: string): Promise<Quote | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return null;
    }

    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    const quote = fromSupabaseFormat(data as SupabaseQuoteRow);
    const { profile } = await fetchOwnerProfile(supabase, quote.userId || null);
    quote.ownerProfile = profile;

    return quote;
  } catch {
    return null;
  }
}

// Get all quotes by device token (using secure RPC)
export async function getQuotesByDeviceToken(deviceToken: string): Promise<Quote[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase.rpc("get_device_quotes", {
      p_device_token: deviceToken,
    });

    if (error || !data) {
      return [];
    }

    // Usually we don't need profile for the list view
    return (data as SupabaseQuoteRow[]).map(fromSupabaseFormat);
  } catch {
    return [];
  }
}

// Count quotes by device token
export async function countDeviceQuotes(deviceToken: string): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) {
    return 0;
  }

  try {
    const { data, error } = await supabase.rpc("count_device_quotes", {
      p_device_token: deviceToken,
    });

    if (error) {
      return 0;
    }

    return data || 0;
  } catch {
    return 0;
  }
}

