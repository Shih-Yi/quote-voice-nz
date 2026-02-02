import { UserProfile } from "@/types/quote";

const STORAGE_KEY = "ksq_provider_details";

export const getStoredProviderDetails = (): Partial<UserProfile> => {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.error("Failed to load provider details", e);
    return {};
  }
};

export const saveProviderDetailsToStorage = (details: Partial<UserProfile>) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(details));
  } catch (e) {
    console.error("Failed to save provider details", e);
  }
};

export const clearStoredProviderDetails = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
};
