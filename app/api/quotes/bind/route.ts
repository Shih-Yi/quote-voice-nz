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

  // Cap on how many anon quotes a single bind call can claim. Stops a bad
  // actor from pre-generating thousands of anon quotes and dumping them on a
  // fresh account. Legitimate users rarely have more than a handful of
  // pre-signup drafts; anything above this cap stays anonymous and gets
  // cleaned up by cleanup_anon_orphan_quotes later.
  const MAX_BIND_PER_CALL = 50;

  try {
    // Select the newest-first batch of candidate rows so the cap always keeps
    // the user's most recent work rather than a random slice.
    const { data: candidates, error: selectError } = await supabase
      .from("quotes")
      .select("id")
      .eq("owner_token_hash", tokenHash)
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(MAX_BIND_PER_CALL);

    if (selectError) {
      console.error("[/api/quotes/bind] Select error:", selectError);
      return NextResponse.json(
        { error: "Failed to bind quotes" },
        { status: 500 }
      );
    }

    const ids = (candidates ?? []).map((row: { id: string }) => row.id);
    if (ids.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const { data, error } = await supabase
      .from("quotes")
      .update({ user_id: user.id })
      .in("id", ids)
      .is("user_id", null)
      .select("id");

    if (error) {
      console.error("[/api/quotes/bind] Error:", error);
      return NextResponse.json(
        { error: "Failed to bind quotes" },
        { status: 500 }
      );
    }

    const count = data?.length ?? 0;
    if (count === MAX_BIND_PER_CALL) {
      console.warn(
        `[/api/quotes/bind] Hit MAX_BIND_PER_CALL for user=${user.id} — older anon quotes left unbound`
      );
    }
    return NextResponse.json({ success: true, count });
  } catch (err) {
    console.error("[/api/quotes/bind] Exception:", err);
    return NextResponse.json(
      { error: "Failed to bind quotes" },
      { status: 500 }
    );
  }
}
