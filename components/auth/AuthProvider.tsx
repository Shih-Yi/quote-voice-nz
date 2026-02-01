"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  getCurrentUser,
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  onAuthStateChange,
} from "@/lib/supabase/auth";
import { getDeviceToken } from "@/lib/storage/deviceToken";
import { bindDeviceQuotesToUser } from "@/lib/supabase/quotes";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInGoogle: () => Promise<{ error: string | null }>;
  logout: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Bind all device quotes to the user (single device token)
  const bindLocalQuotesToUser = useCallback(async (userId: string) => {
    try {
      const deviceToken = await getDeviceToken();
      console.log("[Auth] Binding quotes - deviceToken:", deviceToken, "userId:", userId);

      const result = await bindDeviceQuotesToUser(deviceToken, userId);
      console.log("[Auth] Bind result:", result);

      if (result.count > 0) {
        console.log(`[Auth] Bound ${result.count} quotes to user`);
      } else if (result.error) {
        console.error("[Auth] Bind error:", result.error);
      } else {
        console.log("[Auth] No quotes to bind (count: 0)");
      }
    } catch (err) {
      console.error("[Auth] Failed to bind quotes:", err);
    }
  }, []);

  useEffect(() => {
    // Get initial user
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });

    // Listen for auth changes
    const unsubscribe = onAuthStateChange((newUser) => {
      setUser(newUser);

      // When user logs in, bind their local quotes
      if (newUser) {
        bindLocalQuotesToUser(newUser.id);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [bindLocalQuotesToUser]);

  const signUp = useCallback(async (email: string, password: string) => {
    const { user: newUser, error } = await signUpWithEmail(email, password);
    if (error) {
      return { error };
    }
    if (newUser) {
      setUser(newUser);
      await bindLocalQuotesToUser(newUser.id);
    }
    return { error: null };
  }, [bindLocalQuotesToUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user: newUser, error } = await signInWithEmail(email, password);
    if (error) {
      return { error };
    }
    if (newUser) {
      setUser(newUser);
      await bindLocalQuotesToUser(newUser.id);
    }
    return { error: null };
  }, [bindLocalQuotesToUser]);

  const signInGoogle = useCallback(async () => {
    const { error } = await signInWithGoogle();
    return { error };
  }, []);

  const logout = useCallback(async () => {
    const { error } = await signOut();
    if (!error) {
      setUser(null);
    }
    return { error };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signInGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
