import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { getServerSupabase } from "@/lib/supabase/server";
import { getCurrentUserServer } from "@/lib/supabase/auth-server";
import { profileUpdateSchema, firstIssueMessage } from "@/lib/schemas/profile";

export async function GET(request: NextRequest) {
  const rateLimited = await rateLimit(request, { limit: 20, windowSeconds: 60 });
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

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, business_name, phone, email, address, bank_account")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ profile: null });
  }

  return NextResponse.json({
    profile: {
      id: data.id,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      businessName: data.business_name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      bankAccount: data.bank_account,
    },
  });
}

export async function PUT(request: NextRequest) {
  const rateLimited = await rateLimit(request, { limit: 10, windowSeconds: 60 });
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
    const body = await request.json().catch(() => null);
    if (body === null || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Previously every field went straight into the database: no length caps,
    // no type check, and no format check on the bank account that the customer
    // is asked to pay into.
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error) },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const updateData = {
      id: user.id,
      full_name: input.fullName ?? null,
      business_name: input.businessName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      bank_account: input.bankAccount ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(updateData, { onConflict: "id" });

    if (error) {
      console.error("[/api/profile] Upsert error:", error);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[/api/profile] Exception:", err);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
