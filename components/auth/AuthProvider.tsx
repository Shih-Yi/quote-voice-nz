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
  bindQuotesToUser,
} from "@/lib/supabase/auth";
import { getAllOwnerTokens } from "@/lib/storage/ownerTokens";

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

  // Bind all local quotes (by owner tokens) to the user
  const bindLocalQuotesToUser = useCallback(async (userId: string) => {
    try {
      const ownerTokens = await getAllOwnerTokens();
      if (ownerTokens.length > 0) {
        const result = await bindQuotesToUser(ownerTokens, userId);
        if (result.count > 0) {
          console.log(`Bound ${result.count} quotes to user`);
        }
      }
    } catch (err) {
      console.error("Failed to bind quotes:", err);
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
