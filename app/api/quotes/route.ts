import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { rateLimit } from "@/lib/rateLimit";
import { getServerSupabase } from "@/lib/supabase/server";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

interface QuotePayload {
  id: string;
  token: string;
  slug: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  providerDetails?: Record<string, unknown> | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  notes?: string | null;
  gstInclusive: boolean;
  status: string;
  parentId?: string | null;
  version?: number;
  createdAt?: string;
}

export async function POST(request: NextRequest) {
  const rateLimited = rateLimit(request, { limit: 30, windowSeconds: 60 });
  if (rateLimited) return rateLimited;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as QuotePayload;

    if (!body.id || !body.token) {
      return NextResponse.json(
        { error: "id and token are required" },
        { status: 400 }
      );
    }

    if (!body.customerName || body.customerName.trim() === "") {
      return NextResponse.json(
        { error: "customerName is required" },
        { status: 400 }
      );
    }

    if (body.status && !["draft", "sent", "accepted"].includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status: ${body.status}` },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.items)) {
      return NextResponse.json(
        { error: "items must be an array" },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(body.token);
    const itemsSum = body.items.reduce((sum, item) => sum + item.total, 0);

    const row = {
      id: body.id,
      slug: body.slug || body.id.slice(0, 8),
      owner_token_hash: tokenHash,
      customer_name: body.customerName,
      customer_phone: body.customerPhone || null,
      customer_email: body.customerEmail || null,
      customer_address: body.customerAddress || null,
      provider_details: body.providerDetails || null,
      items: body.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total,
      })),
      notes: body.notes || null,
      gst_inclusive: body.gstInclusive,
      items_sum: itemsSum,
      // subtotal, gst, total are GENERATED ALWAYS columns — do not insert/update
      status: body.status || "draft",
      parent_id: body.parentId || null,
      version: body.version || 1,
      created_at: body.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Check if quote already exists and verify ownership
    const { data: existing } = await supabase
      .from("quotes")
      .select("owner_token_hash")
      .eq("id", body.id)
      .single();

    if (existing) {
      // Existing quote — verify ownership before update
      if (existing.owner_token_hash !== tokenHash) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }

      // Update (exclude id and created_at)
      const { id: _id, created_at: _createdAt, ...updateData } = row;
      const { error } = await supabase
        .from("quotes")
        .update(updateData)
        .eq("id", body.id);

      if (error) {
        console.error("[/api/quotes] Update error:", error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
    } else {
      // New quote — insert
      const { error } = await supabase
        .from("quotes")
        .insert(row);

      if (error) {
        console.error("[/api/quotes] Insert error:", error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[/api/quotes] POST exception:", err);
    return NextResponse.json(
      { error: "Failed to save quote" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimited = rateLimit(request, { limit: 10, windowSeconds: 60 });
  if (rateLimited) return rateLimited;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    const { id, token } = await request.json();

    if (!id || !token) {
      return NextResponse.json(
        { error: "id and token are required" },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);

    // Verify ownership before deleting
    const { data: existing } = await supabase
      .from("quotes")
      .select("owner_token_hash")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    if (existing.owner_token_hash !== tokenHash) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from("quotes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("[/api/quotes] Delete error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[/api/quotes] DELETE exception:", err);
    return NextResponse.json(
      { error: "Failed to delete quote" },
      { status: 500 }
    );
  }
}
