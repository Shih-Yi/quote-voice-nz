import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getServerSupabase } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/supabase/subscription";

export async function POST(request: NextRequest) {
  // Rate limit: 5 accepts per minute per IP
  const rateLimited = await rateLimit(request, { limit: 5, windowSeconds: 60 });
  if (rateLimited) return rateLimited;

  try {
    const { slug } = await request.json();

    if (!slug || typeof slug !== "string") {
      return NextResponse.json(
        { error: "Missing quote slug" },
        { status: 400 }
      );
    }

    const supabase = getServerSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
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

    // Online acceptance is a paid feature of the owner's plan. The UI already
    // withholds the Accept button in that case (see canAcceptOnline in
    // app/q/[slug]/page.tsx); this is the server-side backstop for anyone
    // calling the API directly.
    //
    // The message stays neutral on purpose. The caller here is the *customer*,
    // who can neither upgrade nor be told about the tradie's billing status —
    // naming the plan would leak the owner's subscription tier to a third party.
    if (quoteRow.user_id) {
      const ownerTier = await getUserTier(quoteRow.user_id);
      if (ownerTier === "free") {
        console.warn(
          `[/api/accept-quote] TIER_BLOCKED slug=${slug} owner=${quoteRow.user_id}`
        );
        return NextResponse.json(
          { error: "This quote can't be accepted online. Please contact the sender directly." },
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
