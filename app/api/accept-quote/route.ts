import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getSupabase } from "@/lib/supabase/client";
import { getUserTier } from "@/lib/supabase/subscription";

export async function POST(request: NextRequest) {
  // Rate limit: 5 accepts per minute per IP
  const rateLimited = rateLimit(request, { limit: 5, windowSeconds: 60 });
  if (rateLimited) return rateLimited;

  try {
    const { slug } = await request.json();

    if (!slug || typeof slug !== "string") {
      return NextResponse.json(
        { error: "Missing quote slug" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    // Look up the quote to find the owner's user_id
    const { data: quoteRow } = await supabase
      .from("quotes")
      .select("id, user_id, status")
      .eq("slug", slug)
      .single();

    if (!quoteRow || quoteRow.status !== "sent") {
      return NextResponse.json(
        { error: "Quote not found or cannot be accepted" },
        { status: 404 }
      );
    }

    // Free-tier owners cannot have quotes accepted (Accepted status is Pro+)
    if (quoteRow.user_id) {
      const ownerTier = await getUserTier(quoteRow.user_id);
      if (ownerTier === "free") {
        return NextResponse.json(
          { error: "Quote acceptance requires a Pro or Team plan. Please ask the tradie to upgrade." },
          { status: 403 }
        );
      }
    }

    // Only allow accepting quotes that are currently "sent"
    const { data, error } = await supabase
      .from("quotes")
      .update({ status: "accepted" })
      .eq("slug", slug)
      .eq("status", "sent")
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Quote not found or cannot be accepted" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Accept quote error:", error);
    return NextResponse.json(
      { error: "Failed to accept quote" },
      { status: 500 }
    );
  }
}
