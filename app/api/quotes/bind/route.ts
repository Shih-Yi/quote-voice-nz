import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { rateLimit } from "@/lib/rateLimit";
import { getServerSupabase } from "@/lib/supabase/server";
import { getCurrentUserServer } from "@/lib/supabase/auth-server";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Bind anonymous device quotes to a logged-in user
export async function POST(request: NextRequest) {
  const rateLimited = await rateLimit(request, { limit: 5, windowSeconds: 60 });
  if (rateLimited) return rateLimited;

  const user = await getCurrentUserServer();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "token is required" },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);

    // Update all quotes matching this token hash that have no user_id yet
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
