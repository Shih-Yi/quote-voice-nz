import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getServerSupabase } from "@/lib/supabase/server";
import { getCurrentUserServer } from "@/lib/supabase/auth-server";

// GET /api/quotes/mine
// Returns all quotes owned by the authenticated user (by user_id, not token).
// Used by the client to rehydrate IndexedDB after login / on a fresh device,
// because device-token-based listing breaks once local data is cleared.
export async function GET(request: NextRequest) {
  const user = await getCurrentUserServer();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

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
    const { data, error } = await supabase
      .from("quotes")
      .select(
        "id, slug, user_id, customer_name, customer_phone, customer_email, customer_address, provider_details, items, notes, gst_inclusive, items_sum, subtotal, gst, total, status, parent_id, version, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[/api/quotes/mine] Select error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ quotes: data ?? [] });
  } catch (err) {
    console.error("[/api/quotes/mine] Exception:", err);
    return NextResponse.json(
      { error: "Failed to load quotes" },
      { status: 500 }
    );
  }
}
