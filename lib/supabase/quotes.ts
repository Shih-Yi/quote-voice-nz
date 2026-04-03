import { getSupabase } from "./client";
import type { Quote, LineItem, UserProfile } from "@/types/quote";

interface SupabaseQuoteRow {
  id: string;
  slug: string;
  owner_token: string;
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

// Helper to fetch owner profile and subscription tier
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

// Convert local Quote to Supabase format
function toSupabaseFormat(quote: Quote, deviceToken: string): Record<string, unknown> {
  const itemsSum = quote.items.reduce((sum, item) => sum + item.total, 0);

  return {
    id: quote.id,
    slug: quote.slug || quote.id.slice(0, 8),
    owner_token: deviceToken,
    customer_name: quote.customerName,
    customer_phone: quote.customerPhone || null,
    customer_email: quote.customerEmail || null,
    customer_address: quote.customerAddress || null,
    provider_details: quote.providerDetails || null,
    items: quote.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.total,
    })),
    notes: quote.notes || null,
    gst_inclusive: quote.gstInclusive,
    items_sum: itemsSum,
    subtotal: quote.subtotal,
    gst: quote.gst,
    total: quote.total,
    status: quote.status,
    parent_id: quote.parentId || null,   // Version tracking
    version: quote.version || 1,          // Default to V1
    created_at: quote.createdAt,
    updated_at: quote.updatedAt,
  };
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

// Save quote to Supabase
export async function saveQuoteToSupabase(
  quote: Quote,
  deviceToken: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: "Supabase not configured" };
  }

  try {
    const data = toSupabaseFormat(quote, deviceToken);

    const { error } = await supabase
      .from("quotes")
      .upsert(data, { onConflict: "id" });

    if (error) {
      console.error("Supabase save error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Supabase save exception:", err);
    return { success: false, error: "Failed to save to cloud" };
  }
}

// Update quote in Supabase
export async function updateQuoteInSupabase(
  quote: Quote,
  deviceToken: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: "Supabase not configured" };
  }

  const itemsSum = quote.items.reduce((sum, item) => sum + item.total, 0);

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const updateData = {
      customer_name: quote.customerName,
      customer_phone: quote.customerPhone || null,
      customer_email: quote.customerEmail || null,
      customer_address: quote.customerAddress || null,
      provider_details: quote.providerDetails || null,
      items: quote.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total,
      })),
      notes: quote.notes || null,
      gst_inclusive: quote.gstInclusive,
      items_sum: itemsSum,
      subtotal: quote.subtotal,
      gst: quote.gst,
      total: quote.total,
      status: quote.status,
    };

    if (user) {
      // Authenticated: Use standard RLS update
      const { error } = await supabase
        .from("quotes")
        .update(updateData)
        .eq("id", quote.id);

      if (error) throw error;
    } else {
      // Anonymous: Use secure RPC (token in body, not URL)
      const { data: success, error } = await supabase.rpc("update_quote_anon", {
        p_id: quote.id,
        p_token: deviceToken,
        p_payload: updateData,
      });

      if (error) throw error;
      if (!success) return { success: false, error: "Quote not found or access denied" };
    }

    return { success: true };
  } catch (err) {
    console.error("Supabase update exception:", err);
    return { success: false, error: (err as Error).message || "Failed to update in cloud" };
  }
}

// Delete quote from Supabase
export async function deleteQuoteFromSupabase(
  id: string,
  deviceToken: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: "Supabase not configured" };
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from("quotes")
        .delete()
        .eq("id", id);

      if (error) throw error;
    } else {
      // Anonymous: Use secure RPC (token in body, not URL)
      const { data: success, error } = await supabase.rpc("delete_quote_anon", {
        p_id: id,
        p_token: deviceToken,
      });

      if (error) throw error;
      if (!success) return { success: false, error: "Quote not found or access denied" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete from cloud" };
  }
}

// Get quote by slug (public - for shared links)
export async function getQuoteBySlugFromSupabase(slug: string): Promise<Quote | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error || !data) {
      return null;
    }

    const quote = fromSupabaseFormat(data as SupabaseQuoteRow);
    const { profile, tier } = await fetchOwnerProfile(supabase, quote.userId || null);
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

// Bind all device quotes to user after registration/login
export async function bindDeviceQuotesToUser(
  deviceToken: string,
  userId: string
): Promise<{ count: number; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { count: 0, error: "Supabase not configured" };
  }

  try {
    const { data, error } = await supabase.rpc("bind_device_quotes_to_user", {
      p_device_token: deviceToken,
      p_user_id: userId,
    });

    if (error) {
      console.error("Bind quotes error:", error);
      return { count: 0, error: error.message };
    }

    return { count: data || 0, error: null };
  } catch (err) {
    console.error("Bind quotes exception:", err);
    return { count: 0, error: "Failed to bind quotes" };
  }
}
