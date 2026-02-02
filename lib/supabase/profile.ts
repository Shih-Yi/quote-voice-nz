import { getSupabase } from "./client";
import type { UserProfile } from "@/types/quote";

// Get the current user's profile
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      // It's possible the profile doesn't exist yet
      return null;
    }

    return {
      id: data.id,
      businessName: data.business_name,
      phone: data.phone,
      email: data.email,
      address: data.address,
      bankAccount: data.bank_account,
      // Note: db schema doesn't have gst_number yet, assuming we might add it or map it to something else
      // For now, let's stick to what's in the DB schema based on previous read
    };
  } catch (err) {
    console.error("Error fetching profile:", err);
    return null;
  }
}

// Update the current user's profile
export async function updateUserProfile(userId: string, profile: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { success: false, error: "Supabase not configured" };

  try {
    const updateData = {
      business_name: profile.businessName,
      phone: profile.phone,
      email: profile.email,
      address: profile.address,
      bank_account: profile.bankAccount,
      updated_at: new Date().toISOString(),
    };

    // Upsert so it creates if not exists
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...updateData });

    if (error) {
      console.error("Profile update error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("Profile update exception:", err);
    return { success: false, error: "Failed to update profile" };
  }
}
