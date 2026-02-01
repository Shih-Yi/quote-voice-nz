"use client";

import { useAuthContext } from "@/components/auth/AuthProvider";

// Re-export the hook from the context provider
export const useAuth = useAuthContext;
