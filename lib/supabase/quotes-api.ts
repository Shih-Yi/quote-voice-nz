import type { Quote } from "@/types/quote";

// Sync quote to Supabase via Next.js API route
export async function syncQuoteToSupabase(
  quote: Quote,
  deviceToken: string
): Promise<{ success: boolean; error?: string }> {
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
      return { success: false, error: body.error || `HTTP ${res.status}` };
    }

    return { success: true };
  } catch (err) {
    console.error("Supabase sync exception:", err);
    return { success: false, error: "Failed to sync to cloud" };
  }
}

// Delete quote from Supabase via Next.js API route
export async function deleteQuoteFromSupabase(
  id: string,
  deviceToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/quotes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, token: deviceToken }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.error || `HTTP ${res.status}` };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete from cloud" };
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
