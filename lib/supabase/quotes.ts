import { getSupabase } from "./client";
import type { Quote, LineItem } from "@/types/quote";

interface SupabaseQuoteRow {
  id: string;
  slug: string;
  owner_token: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  items: SupabaseQuoteItem[];
  notes: string | null;
  gst_inclusive: boolean;
  subtotal: number;
  gst: number;
  total: number;
  status: string;
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

// Convert local Quote to Supabase format
function toSupabaseFormat(quote: Quote, ownerToken: string): Record<string, unknown> {
  return {
    id: quote.id,
    slug: quote.slug || quote.id.slice(0, 8),
    owner_token: ownerToken,
    customer_name: quote.customerName,
    customer_phone: quote.customerPhone || null,
    customer_email: quote.customerEmail || null,
    customer_address: quote.customerAddress || null,
    items: quote.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.total,
    })),
    notes: quote.notes || null,
    gst_inclusive: quote.gstInclusive,
    subtotal: quote.subtotal,
    gst: quote.gst,
    total: quote.total,
    status: quote.status,
    created_at: quote.createdAt,
    updated_at: quote.updatedAt,
  };
}

// Convert Supabase format to local Quote (excludes owner_token for security)
function fromSupabaseFormat(row: SupabaseQuoteRow): Quote {
  return {
    id: row.id,
    slug: row.slug,
    // Note: owner_token is NOT included here - it stays in localStorage only
    customerName: row.customer_name,
    customerPhone: row.customer_phone ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    customerAddress: row.customer_address ?? undefined,
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

// Save quote to Supabase (INSERT or UPDATE)
export async function saveQuoteToSupabase(
  quote: Quote,
  ownerToken: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: "Supabase not configured" };
  }

  try {
    const data = toSupabaseFormat(quote, ownerToken);

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

// Update quote in Supabase (requires owner_token)
export async function updateQuoteInSupabase(
  quote: Quote,
  ownerToken: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: "Supabase not configured" };
  }

  try {
    const { error } = await supabase
      .from("quotes")
      .update({
        customer_name: quote.customerName,
        customer_phone: quote.customerPhone || null,
        customer_email: quote.customerEmail || null,
        customer_address: quote.customerAddress || null,
        items: quote.items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total: item.total,
        })),
        notes: quote.notes || null,
        gst_inclusive: quote.gstInclusive,
        subtotal: quote.subtotal,
        gst: quote.gst,
        total: quote.total,
        status: quote.status,
      })
      .eq("id", quote.id)
      .eq("owner_token", ownerToken);  // Security: only owner can update

    if (error) {
      console.error("Supabase update error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Supabase update exception:", err);
    return { success: false, error: "Failed to update in cloud" };
  }
}

// Get quote by slug from Supabase (for public sharing - no owner_token needed)
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

    return fromSupabaseFormat(data as SupabaseQuoteRow);
  } catch {
    return null;
  }
}

// Get quote by ID from Supabase
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

    return fromSupabaseFormat(data as SupabaseQuoteRow);
  } catch {
    return null;
  }
}

// Delete quote from Supabase (requires owner_token)
export async function deleteQuoteFromSupabase(
  id: string,
  ownerToken: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, error: "Supabase not configured" };
  }

  try {
    const { error } = await supabase
      .from("quotes")
      .delete()
      .eq("id", id)
      .eq("owner_token", ownerToken);  // Security: only owner can delete

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete from cloud" };
  }
}

// Get all quotes from Supabase (for a list of owner tokens)
export async function getQuotesByOwnerTokens(ownerTokens: string[]): Promise<Quote[]> {
  const supabase = getSupabase();
  if (!supabase || ownerTokens.length === 0) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .in("owner_token", ownerTokens)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return (data as SupabaseQuoteRow[]).map(fromSupabaseFormat);
  } catch {
    return [];
  }
}
