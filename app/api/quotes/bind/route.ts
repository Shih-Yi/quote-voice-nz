import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { rateLimit } from "@/lib/rateLimit";
import { claimIdempotencyKey } from "@/lib/idempotency";
import { getServerSupabase } from "@/lib/supabase/server";
import { getCurrentUserServer } from "@/lib/supabase/auth-server";

const IDEMPOTENCY_TTL_SECONDS = 10;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Bind anonymous device quotes to a logged-in user
export async function POST(request: NextRequest) {
  const user = await getCurrentUserServer();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  let token: string | undefined;
  try {
    const body = await request.json();
    token = body?.token;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const tokenHash = hashToken(token);

  // Idempotency: if the same (user, device token) was bound within the TTL,
  // short-circuit with a success response. Prevents duplicate Supabase fire
  // events (INITIAL_SESSION / TOKEN_REFRESHED / SIGNED_IN) from hammering DB
  // and rate limit.
  const idempotencyKey = `bind:${user.id}:${tokenHash}`;
  const firstCall = await claimIdempotencyKey(
    idempotencyKey,
    IDEMPOTENCY_TTL_SECONDS
  );
  if (!firstCall) {
    return NextResponse.json({ success: true, count: 0, cached: true });
  }

  // Still enforce a rate limit for genuinely new attempts (different tokens,
  // different users on shared IP, etc.).
  const rateLimited = await rateLimit(request, { limit: 5, windowSeconds: 60 });
  if (rateLimited) return rateLimited;

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    // Update all quotes matching this token hash that have no user_id yet.
    // The WHERE clause makes this naturally idempotent at the DB level too.
    const { data, error } = await supabase
      .from("quotes")
      .update({ user_id: user.id })
      .eq("owner_token_hash", tokenHash)
      .is("user_id", null)
      .select("id");

    if (error) {
      console.error("[/api/quotes/bind] Error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const count = data?.length ?? 0;
    return NextResponse.json({ success: true, count });
  } catch (err) {
    console.error("[/api/quotes/bind] Exception:", err);
    return NextResponse.json(
      { error: "Failed to bind quotes" },
      { status: 500 }
    );
  }
}
