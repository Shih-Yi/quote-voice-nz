import type { UserProfile } from "@/types/quote";

// Update the current user's profile via Next.js API route
export async function updateUserProfile(_userId: string, profile: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: profile.fullName,
        businessName: profile.businessName,
        phone: profile.phone,
        email: profile.email,
        address: profile.address,
        bankAccount: profile.bankAccount,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.error || `HTTP ${res.status}` };
    }

    return { success: true };
  } catch (err) {
    console.error("Profile update exception:", err);
    return { success: false, error: "Failed to update profile" };
  }
}
