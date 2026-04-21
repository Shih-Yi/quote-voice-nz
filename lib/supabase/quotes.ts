import { getSupabase } from "./client";
import type { Quote, LineItem, UserProfile } from "@/types/quote";

interface SupabaseQuoteRow {
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
  // Joined owner profile fields (only present on get_quote_by_slug RPC rows)
  owner_business_name?: string | null;
  owner_phone?: string | null;
  owner_email?: string | null;
  owner_address?: string | null;
  owner_bank_account?: string | null;
  owner_subscription_tier?: string | null;
}

interface SupabaseQuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface OwnerProfileResult {
  profile: UserProfile | undefined;
  /** "free" | "pro" | "team" — defaults to "free" when unknown */
  tier: string;
}

// Extract owner profile/tier from a JOINed RPC row (no extra round trip)
function extractOwnerFromRow(row: SupabaseQuoteRow): OwnerProfileResult {
  if (!row.user_id) return { profile: undefined, tier: "free" };

  const hasAny =
    row.owner_business_name ||
    row.owner_phone ||
    row.owner_email ||
    row.owner_address ||
    row.owner_bank_account;

  const profile: UserProfile | undefined = hasAny
    ? {
        id: row.user_id,
        businessName: row.owner_business_name ?? undefined,
        phone: row.owner_phone ?? undefined,
        email: row.owner_email ?? undefined,
        address: row.owner_address ?? undefined,
        bankAccount: row.owner_bank_account ?? undefined,
      }
    : undefined;

  return { profile, tier: row.owner_subscription_tier ?? "free" };
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
        tier: data.subscription_tier ?? "free",
      };
    }
  } catch {
    // Ignore errors, profile might not exist
  }
  return { profile: undefined, tier: "free" };
}


// Convert Supabase format to local Quote
function fromSupabaseFormat(row: SupabaseQuoteRow): Quote {
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
    // Show watermark when creator is on free tier (or no user = anonymous)
    quote.showWatermark = !quote.userId || tier === "free";

    return quote;
  } catch {
    return null;
  }
}

// Get quote by ID
export async function getQuoteByIdFromSupabase(id: string): Promise<Quote | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  try {
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

