import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { rateLimit } from "@/lib/rateLimit";
import { claimIdempotencyKey } from "@/lib/idempotency";
import { getServerSupabase } from "@/lib/supabase/server";
import { getCurrentUserServer } from "@/lib/supabase/auth-server";
import { generateRandomSlug, isValidSlug } from "@/lib/utils/randomId";
import {
  checkAnonQuoteDeviceQuota,
  checkAnonQuoteIpQuota,
  LIMITS,
} from "@/lib/costGuard";
import {
  checkAndIncrementUsage,
  getMonthlyUsage,
  getUserTier,
  TIER_LIMITS,
} from "@/lib/supabase/subscription";

const IDEMPOTENCY_TTL_SECONDS = 10;

interface OwnershipRow {
  owner_token_hash: string;
  user_id: string | null;
}

// Unified ownership rule (replaces pure token-based check).
// After bind, cloud rows have user_id set. A user on a different device will
// have a different device token, so token-only check would 403 them off their
// own data. With user_id present, we require it to match the session user.
// For anonymous rows (user_id === null), we fall back to the token hash.
//
// Returns null on success, or the HTTP response to return.
function assertOwnership(
  existing: OwnershipRow,
  user: { id: string } | null,
  tokenHash: string
): NextResponse | null {
  // Treat null and undefined the same — Postgres returns null for empty
  // columns, but some callers/mocks leave the field off entirely.
  const boundUserId = existing.user_id ?? null;

  if (boundUserId !== null) {
    if (!user || user.id !== boundUserId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return null;
  }
  if (existing.owner_token_hash !== tokenHash) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  return null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers?.get?.("x-real-ip") ||
    "unknown"
  );
}

// Slug generation lives in lib/utils/randomId — it is CSPRNG-backed because a
// slug is the only thing standing between a stranger and the customer's
// contact details on /q/[slug].

function isSlugConflictError(error: { code?: string; message?: string }): boolean {
  // PostgreSQL unique_violation = 23505; also check message for slug constraint
  return error.code === "23505" && (error.message?.includes("slug") ?? false);
}

// Conservative caps on free-form text fields — guards against a broken or
// malicious client sending multi-MB strings that bloat the DB and log lines.
const MAX_NAME_LEN = 200;
const MAX_EMAIL_LEN = 320;          // RFC 5321
const MAX_PHONE_LEN = 40;
const MAX_ADDRESS_LEN = 500;
const MAX_NOTES_LEN = 5000;
const MAX_DESCRIPTION_LEN = 1000;
const MAX_ITEMS = 100;
// provider_details is free-form JSONB written straight from the client. Cap
// its serialised size so a broken or hostile client cannot park megabytes in
// the row (and in every log line that echoes it).
const MAX_PROVIDER_DETAILS_BYTES = 4000;

function lenError(field: string, max: number): string {
  return `${field} exceeds maximum length (${max})`;
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
  const rateLimited = await rateLimit(request, { limit: 30, windowSeconds: 60 });
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

    // Length caps — reject oversized strings and runaway item counts.
    const lengthChecks: Array<[string, string | null | undefined, number]> = [
      ["customerName", body.customerName, MAX_NAME_LEN],
      ["customerEmail", body.customerEmail, MAX_EMAIL_LEN],
      ["customerPhone", body.customerPhone, MAX_PHONE_LEN],
      ["customerAddress", body.customerAddress, MAX_ADDRESS_LEN],
      ["notes", body.notes, MAX_NOTES_LEN],
    ];
    for (const [field, value, max] of lengthChecks) {
      if (typeof value === "string" && value.length > max) {
        return NextResponse.json({ error: lenError(field, max) }, { status: 400 });
      }
    }

    if (body.items.length > MAX_ITEMS) {
      return NextResponse.json(
        { error: `items exceeds maximum (${MAX_ITEMS})` },
        { status: 400 }
      );
    }

    // The slug goes into a public URL and carries a UNIQUE constraint, so it
    // was the one client-supplied string with neither a length nor a charset
    // check. Legacy 8-character slugs still validate.
    if (body.slug !== undefined && !isValidSlug(body.slug)) {
      return NextResponse.json(
        { error: "slug must be 6-32 lowercase letters or digits" },
        { status: 400 }
      );
    }

    if (body.providerDetails != null) {
      const serialised = JSON.stringify(body.providerDetails);
      if (serialised.length > MAX_PROVIDER_DETAILS_BYTES) {
        return NextResponse.json(
          { error: lenError("providerDetails", MAX_PROVIDER_DETAILS_BYTES) },
          { status: 400 }
        );
      }
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
      if (typeof item.description === "string" && item.description.length > MAX_DESCRIPTION_LEN) {
        return NextResponse.json(
          { error: lenError(`items[${index}].description`, MAX_DESCRIPTION_LEN) },
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
    // Sum in integer cents. Adding 2dp floats and rounding once at the end
    // accumulates error across many items; the client derives its own copy of
    // this figure the same way (lib/utils/gst.ts) and the two must not drift.
    const itemsSum =
      sanitizedItems.reduce((sum, item) => sum + Math.round(item.total * 100), 0) /
      100;

    const tokenHash = hashToken(body.token);
    const op = "POST";
    const user = await getCurrentUserServer();

    console.log(`[/api/quotes] ${op} start id=${body.id} slug=${body.slug} status=${body.status} items=${sanitizedItems.length} items_sum=${itemsSum} user=${user?.id ?? "anon"}`);

    // Idempotency — skip duplicate work when the same logical request (same
    // owner + id + version) arrives within the TTL window. Common cause:
    // network jitter triggers a client retry while the first call is still in
    // flight or just committed. Without this gate, the duplicate would re-run
    // upsert (bumping updated_at) and the slug-collision retry loop.
    //
    // Header `Idempotency-Key` lets the client pin a key explicitly; otherwise
    // we derive a deterministic one from owner + id + version. The DB upsert
    // is itself idempotent on `id`, so a fall-through after a missed cache
    // (e.g. first call still in flight when retry lands) is safe.
    const ownerKey = user?.id ?? tokenHash;
    const idempotencyKey =
      request.headers?.get?.("idempotency-key")?.slice(0, 200) ||
      `${ownerKey}:${body.id}:v${body.version || 1}`;
    const idemRedisKey = `quotes:${idempotencyKey}`;
    const isFirstCall = await claimIdempotencyKey(
      idemRedisKey,
      IDEMPOTENCY_TTL_SECONDS
    );
    if (!isFirstCall) {
      const { data: cachedRow, error: cachedRowError } = await supabase
        .from("quotes")
        .select("slug, owner_token_hash, user_id, updated_at")
        .eq("id", body.id)
        .maybeSingle<OwnershipRow & { slug: string; updated_at: string }>();
      if (cachedRowError) {
        console.error(
          `[/api/quotes] ${op} IDEMPOTENT_LOOKUP_ERROR id=${body.id}`,
          cachedRowError
        );
        return NextResponse.json(
          { error: "Failed to verify quote state" },
          { status: 500 }
        );
      }
      if (cachedRow?.slug) {
        const denied = assertOwnership(cachedRow, user, tokenHash);
        if (denied) {
          console.warn(
            `[/api/quotes] ${op} IDEMPOTENT_DENIED id=${body.id} — ownership mismatch on cached row`
          );
          return denied;
        }
        console.log(
          `[/api/quotes] ${op} IDEMPOTENT_HIT id=${body.id} slug=${cachedRow.slug}`
        );
        return NextResponse.json({
          success: true,
          slug: cachedRow.slug,
          updatedAt: cachedRow.updated_at,
          cached: true,
        });
      }
      // Row not found — first call still in flight. Fall through; the DB
      // upsert is keyed on `id` so concurrent inserts converge on one row.
    }

    // Check if quote already exists and verify ownership under the unified
    // user_id-preferred rule.
    const { data: existing, error: existingError } = await supabase
      .from("quotes")
      .select("owner_token_hash, user_id, status")
      .eq("id", body.id)
      .maybeSingle<OwnershipRow & { status: string | null }>();

    if (existingError) {
      console.error(
        `[/api/quotes] ${op} EXISTING_LOOKUP_ERROR id=${body.id}`,
        existingError
      );
      return NextResponse.json(
        { error: "Failed to verify quote ownership" },
        { status: 500 }
      );
    }

    if (existing) {
      const denied = assertOwnership(existing, user, tokenHash);
      if (denied) {
        console.warn(
          `[/api/quotes] ${op} DENIED id=${body.id} — ownership mismatch (row.user_id=${existing.user_id}, session.user=${user?.id ?? "anon"})`
        );
        return denied;
      }

      // Status regression guard — once a quote is sent or accepted, never
      // allow it to be reverted back to draft via a stale client retry.
      // DELETE has the equivalent guard; POST needs the same to keep the
      // server as the final authority.
      const incomingStatus = body.status || "draft";
      if (
        (existing.status === "sent" || existing.status === "accepted") &&
        incomingStatus === "draft"
      ) {
        console.warn(
          `[/api/quotes] ${op} STATUS_REGRESSION_BLOCKED id=${body.id} ${existing.status} -> ${incomingStatus}`
        );
        return NextResponse.json(
          {
            error: `Cannot revert a ${existing.status} quote back to draft`,
            status: existing.status,
          },
          { status: 409 }
        );
      }
    }

    // Anonymous NEW rows. The voice path is bounded by the device/IP caps in
    // /api/transcribe, but a manually-typed quote never touches that route, so
    // an anonymous caller had no ceiling here at all beyond the 30/min burst
    // limit. These rows are also the ones cleanup_anon_orphan_quotes reaps, so
    // an unbounded path fills the table with rows nobody can be billed for.
    // Limits are deliberately looser than the transcribe ones — typing costs
    // us no Groq spend, this is about table growth.
    if (!user && !existing) {
      // body.token is the device token — already required above and already
      // hashed for the ownership check, so there is nothing extra to send.
      const deviceGuard = await checkAnonQuoteDeviceQuota(body.token);
      if (!deviceGuard.allowed) {
        console.warn(`[/api/quotes] ${op} ANON_DEVICE_QUOTA id=${body.id}`);
        return NextResponse.json(
          {
            error: "anon_quota_exceeded",
            action: "login_required",
            message: `Free limit reached (${LIMITS.ANON_QUOTE_DEVICE_DAILY}/day). Please log in to keep creating quotes.`,
            limit: LIMITS.ANON_QUOTE_DEVICE_DAILY,
          },
          { status: 429, headers: { "Retry-After": String(deviceGuard.retryAfter) } }
        );
      }

      const ipGuard = await checkAnonQuoteIpQuota(getClientIp(request));
      if (!ipGuard.allowed) {
        console.warn(`[/api/quotes] ${op} ANON_IP_QUOTA id=${body.id}`);
        return NextResponse.json(
          {
            error: "anon_quota_exceeded",
            action: "login_required",
            message: `Daily limit reached from this network (${LIMITS.ANON_QUOTE_IP_DAILY}/day). Please log in to keep creating quotes.`,
            limit: LIMITS.ANON_QUOTE_IP_DAILY,
          },
          { status: 429, headers: { "Retry-After": String(ipGuard.retryAfter) } }
        );
      }
    }

    // Server-side quota gate for logged-in users on NEW quote rows. This route
    // is the single accounting point for quotes_created: every quote reaches
    // it exactly once regardless of how it was authored, so voice and
    // manually-typed quotes both count and neither counts twice. Checked here
    // before the write, incremented after it succeeds.
    if (user && !existing) {
      const tier = await getUserTier(user.id);
      const limits = TIER_LIMITS[tier];
      const usage = await getMonthlyUsage(user.id);
      if (usage.quotesCreated >= limits.quotesPerMonth) {
        console.warn(
          `[/api/quotes] ${op} QUOTA_EXCEEDED user=${user.id} tier=${tier} used=${usage.quotesCreated}/${limits.quotesPerMonth}`
        );
        return NextResponse.json(
          {
            error: "quota_exceeded",
            limit: limits.quotesPerMonth,
            used: usage.quotesCreated,
            tier,
          },
          { status: 429 }
        );
      }
    }

    const row = {
      id: body.id,
      slug: body.slug || body.id.slice(0, 8),
      owner_token_hash: tokenHash,
      // Bind to the session user on insert so ownership is correct from the
      // start — removes reliance on /api/quotes/bind running after the fact.
      // For existing rows we preserve user_id via the UPDATE branch below.
      user_id: user?.id ?? null,
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
    let upsertResult:
      | {
          id: string;
          owner_token_hash: string;
          user_id: string | null;
          updated_at: string;
        }[]
      | null = null;
    let lastError: { message?: string; code?: string } | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: result, error } = await supabase
        .from("quotes")
        .upsert(upsertData, { onConflict: "id" })
        .select("id, owner_token_hash, user_id, updated_at");

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

      // Non-slug error — fail immediately. Postgres messages name the schema,
      // table, column and constraint; keep them in the log, not the response.
      console.error("[/api/quotes] Upsert error:", error);
      return NextResponse.json(
        { error: "Failed to save quote" },
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

    // Post-upsert ownership check: detect races between the pre-upsert SELECT
    // and the UPSERT where a concurrent request with a different owner claimed
    // our id. Service_role bypasses RLS so we verify explicitly, using the
    // same unified rule as the pre-check.
    const raceDenied = assertOwnership(
      {
        owner_token_hash: upsertResult[0].owner_token_hash,
        user_id: upsertResult[0].user_id,
      },
      user,
      tokenHash
    );
    if (raceDenied) {
      console.error(
        `[/api/quotes] ${op} OWNERSHIP_RACE id=${body.id} — row owner changed mid-request`
      );
      return NextResponse.json(
        { error: "Data integrity error — please retry" },
        { status: 409 }
      );
    }

    // Count the quote now that the row is committed. Only on creation — an
    // edit re-POSTs the same id and must not consume a second credit.
    if (user && !existing) {
      const counted = await checkAndIncrementUsage(user.id, "quotes_created");
      if (!counted.allowed) {
        // Another request took the last credit between our pre-check and here.
        // The row is already written; log it rather than orphan the user's work.
        console.warn(
          `[/api/quotes] ${op} QUOTA_RACE id=${body.id} user=${user.id} — row saved past limit ${counted.limit}`
        );
      }
    }

    console.log(`[/api/quotes] ${op} ${action} OK id=${body.id} slug=${upsertData.slug} items_sum=${itemsSum}`);
    // Return the final slug (may differ from request if collision was resolved)
    // and the authoritative updated_at. The client adopts the timestamp so its
    // local copy stops looking permanently older than the cloud row — without
    // it, every hydrate would treat the cloud snapshot as newer and overwrite
    // local state on each page load.
    return NextResponse.json({
      success: true,
      slug: upsertData.slug,
      updatedAt: upsertResult[0].updated_at,
    });
  } catch (err) {
    console.error("[/api/quotes] POST exception:", err);
    return NextResponse.json(
      { error: "Failed to save quote" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimited = await rateLimit(request, { limit: 10, windowSeconds: 60 });
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
    const user = await getCurrentUserServer();

    console.log(`[/api/quotes] DELETE start id=${id} user=${user?.id ?? "anon"}`);

    const { data: existing, error: existingError } = await supabase
      .from("quotes")
      .select("owner_token_hash, user_id, status")
      .eq("id", id)
      .maybeSingle<OwnershipRow & { status: string | null }>();

    if (existingError) {
      console.error(
        `[/api/quotes] DELETE LOOKUP_ERROR id=${id}`,
        existingError
      );
      return NextResponse.json(
        { error: "Failed to verify quote ownership" },
        { status: 500 }
      );
    }

    if (!existing) {
      console.warn(`[/api/quotes] DELETE NOT_FOUND id=${id}`);
      return NextResponse.json(
        { error: "Quote not found" },
        { status: 404 }
      );
    }

    const denied = assertOwnership(existing, user, tokenHash);
    if (denied) {
      console.warn(
        `[/api/quotes] DELETE DENIED id=${id} — ownership mismatch (row.user_id=${existing.user_id}, session.user=${user?.id ?? "anon"})`
      );
      return denied;
    }

    if (existing.status === "sent" || existing.status === "accepted") {
      console.warn(
        `[/api/quotes] DELETE BLOCKED id=${id} status=${existing.status} — protected status`
      );
      return NextResponse.json(
        {
          error: `Cannot delete a quote that has been ${existing.status}`,
          status: existing.status,
        },
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
        { error: "Failed to delete quote" },
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
