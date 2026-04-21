"use client";

import useSWR from "swr";
import { useAuth } from "@/hooks/useAuth";
import type { UserProfile } from "@/types/quote";

interface UseProfileResult {
  profile: UserProfile | null;
  isLoading: boolean;
  error: Error | undefined;
  refresh: () => Promise<UserProfile | null | undefined>;
}

async function fetchProfile(url: string): Promise<UserProfile | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const { profile } = await res.json();
  return profile ?? null;
}

// Shared SWR hook for the current user's profile. Dedupes concurrent
// /api/profile requests across all call sites (ProviderInfo, settings, etc.)
// and caches the result for `dedupingInterval`.
export function useProfile(): UseProfileResult {
  const { user } = useAuth();

  const { data, isLoading, error, mutate } = useSWR<UserProfile | null>(
    user ? "/api/profile" : null,
    fetchProfile,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  return {
    profile: data ?? null,
    isLoading: user ? isLoading : false,
    error,
    refresh: () => mutate(),
  };
}
