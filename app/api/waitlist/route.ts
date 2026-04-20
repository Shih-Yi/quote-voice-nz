import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  // Rate limit: 3 signups per minute per IP
  const rateLimited = await rateLimit(request, { limit: 3, windowSeconds: 60 });
  if (rateLimited) return rateLimited;

  let body: { email?: string; trade?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }

  const trade = body.trade?.trim() || null;

  // Try Supabase insert if configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        db: { schema: "api" },
      });

      const { error } = await supabase.from("waitlist").upsert(
        { email, trade, signed_up_at: new Date().toISOString() },
        { onConflict: "email" }
      );

      if (error) {
        console.error("Waitlist insert error:", error.message);
        // Fall through — still return success to user
      }
    } catch (err) {
      console.error("Supabase waitlist error:", err);
      // Fall through — still return success to user
    }
  } else {
    // No Supabase configured — log to server console
    console.log(`[Waitlist] ${email}${trade ? ` (${trade})` : ""}`);
  }

  return NextResponse.json({ success: true });
}
