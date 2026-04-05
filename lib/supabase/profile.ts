import type { UserProfile } from "@/types/quote";

// Get the current user's profile via Next.js API route (server-side read)
export async function getUserProfile(_userId: string): Promise<UserProfile | null> {
  try {
    const res = await fetch("/api/profile");
    if (!res.ok) return null;

    const { profile } = await res.json();
    return profile ?? null;
  } catch {
    return null;
  }
}

// Update the current user's profile via Next.js API route
export async function updateUserProfile(_userId: string, profile: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
