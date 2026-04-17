import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { rateLimit } from "@/lib/rateLimit";
import { getServerSupabase } from "@/lib/supabase/server";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateRandomSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

function isSlugConflictError(error: { code?: string; message?: string }): boolean {
  // PostgreSQL unique_violation = 23505; also check message for slug constraint
  return error.code === "23505" && (error.message?.includes("slug") ?? false);
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

    // Recompute item totals and items_sum server-side. The client sends total for
    // offline convenience, but never trust it — the DB's GENERATED columns derive
    // subtotal/gst/total from items_sum, so a tampered client total would flow
    // straight into the customer-facing quote.
    const sanitizedItems: Array<{
      id: string;
      description: string;
      quantity: number;
      unit_price: number;
      total: number;
    }> = [];
    for (const [index, item] of body.items.entries()) {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      if (!Number.isFinite(quantity) || quantity < 0) {
        return NextResponse.json(
          { error: `items[${index}].quantity must be a non-negative number` },
          { status: 400 }
        );
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return NextResponse.json(
          { error: `items[${index}].unitPrice must be a non-negative number` },
          { status: 400 }
        );
      }
      const total = Math.round(quantity * unitPrice * 100) / 100;
      sanitizedItems.push({
        id: item.id,
        description: item.description,
        quantity,
        unit_price: unitPrice,
        total,
      });
    }
    const itemsSum = Math.round(
      sanitizedItems.reduce((sum, item) => sum + item.total, 0) * 100
    ) / 100;

    const tokenHash = hashToken(body.token);
    const op = "POST";

    console.log(`[/api/quotes] ${op} start id=${body.id} slug=${body.slug} status=${body.status} items=${sanitizedItems.length} items_sum=${itemsSum}`);

    const row = {
      id: body.id,
      slug: body.slug || body.id.slice(0, 8),
      owner_token_hash: tokenHash,
      customer_name: body.customerName,
      customer_phone: body.customerPhone || null,
      customer_email: body.customerEmail || null,
      customer_address: body.customerAddress || null,
      provider_details: body.providerDetails || null,
      items: sanitizedItems,
      notes: body.notes || null,
      gst_inclusive: body.gstInclusive,
      items_sum: itemsSum,
      // subtotal, gst, total are GENERATED ALWAYS columns derived from items_sum
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

    if (existing && existing.owner_token_hash !== tokenHash) {
      console.warn(`[/api/quotes] ${op} DENIED id=${body.id} — token mismatch`);
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const action = existing ? "UPDATE" : "CREATE";
    console.log(`[/api/quotes] ${op} ${action} id=${body.id}`);

    // Upsert: INSERT ... ON CONFLICT (id) DO UPDATE
    // This uses INSERT privilege (which works) instead of UPDATE privilege
    // (which may be missing for service_role on custom schemas).
    // Exclude created_at for existing quotes to preserve original timestamp.
    const { created_at: _createdAt, ...upsertBase } = row;
    const upsertData: Record<string, unknown> = existing ? { ...upsertBase } : { ...row };

    // Upsert with slug collision retry (up to 3 attempts).
    // We return owner_token_hash in the .select() so we can detect post-upsert
    // ownership mismatch — protects against a race where someone inserted a row
    // with our id between our SELECT and UPSERT.
    let upsertResult: { id: string; owner_token_hash: string }[] | null = null;
    let lastError: { message?: string; code?: string } | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: result, error } = await supabase
        .from("quotes")
        .upsert(upsertData, { onConflict: "id" })
        .select("id, owner_token_hash");

      if (!error) {
        upsertResult = result;
        lastError = null;
        break;
      }

      // If the error is a slug UNIQUE constraint violation, regenerate slug and retry
      if (isSlugConflictError(error) && !existing) {
        const newSlug = generateRandomSlug();
        console.warn(`[/api/quotes] Slug collision on "${upsertData.slug}", retrying with "${newSlug}" (attempt ${attempt + 1})`);
        upsertData.slug = newSlug;
        lastError = error;
        continue;
      }

      // Non-slug error — fail immediately
      console.error("[/api/quotes] Upsert error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (lastError) {
      console.error("[/api/quotes] Upsert failed after slug retries:", lastError);
      return NextResponse.json(
        { error: "Failed to save quote — slug collision" },
        { status: 500 }
      );
    }

    if (!upsertResult || upsertResult.length === 0) {
      console.error("[/api/quotes] Upsert returned 0 rows for id:", body.id);
      return NextResponse.json(
        { error: "Failed to save quote — 0 rows affected" },
        { status: 500 }
      );
    }

    // Post-upsert ownership check: detect races between SELECT (line ~123) and
    // UPSERT where a concurrent request with a different token claimed our id.
    // Service_role bypasses RLS so we verify explicitly.
    if (upsertResult[0].owner_token_hash !== tokenHash) {
      console.error(
        `[/api/quotes] ${op} OWNERSHIP_RACE id=${body.id} — row now owned by a different token hash`
      );
      return NextResponse.json(
        { error: "Data integrity error — please retry" },
        { status: 409 }
      );
    }

    console.log(`[/api/quotes] ${op} ${action} OK id=${body.id} slug=${upsertData.slug} items_sum=${itemsSum}`);
    // Return the final slug (may differ from request if collision was resolved)
    return NextResponse.json({ success: true, slug: upsertData.slug });
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

    console.log(`[/api/quotes] DELETE start id=${id}`);

    // Verify ownership before deleting
    const { data: existing } = await supabase
      .from("quotes")
      .select("owner_token_hash")
      .eq("id", id)
      .single();

    if (!existing) {
      console.warn(`[/api/quotes] DELETE NOT_FOUND id=${id}`);
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    if (existing.owner_token_hash !== tokenHash) {
      console.warn(`[/api/quotes] DELETE DENIED id=${id} — token mismatch`);
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const { data: deleted, error } = await supabase
      .from("quotes")
      .delete()
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("[/api/quotes] Delete error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Detect silent deletion failure (0 rows affected, no error)
    // This can happen when service_role lacks DELETE privilege on the table
    if (!deleted || deleted.length === 0) {
      console.error("[/api/quotes] Delete returned 0 rows — possible permission issue for id:", id);
      return NextResponse.json(
        { error: "Failed to delete quote" },
        { status: 500 }
      );
    }

    console.log(`[/api/quotes] DELETE OK id=${id}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[/api/quotes] DELETE exception:", err);
    return NextResponse.json(
      { error: "Failed to delete quote" },
      { status: 500 }
    );
  }
}
