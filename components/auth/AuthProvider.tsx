"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  getCurrentUser,
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signInWithMagicLink,
  changePassword,
  signOut,
  onAuthStateChange,
  sendPasswordResetEmail,
  updatePassword,
} from "@/lib/supabase/auth";
import {
  setRememberMe,
  markSessionActive,
  clearRememberMe,
  shouldExpireOnBoot,
} from "@/lib/auth/sessionPersistence";
import { validatePassword } from "@/lib/auth/passwordValidation";
import { toFriendlyAuthError } from "@/lib/auth/errorMessages";
import {
  checkAttempt,
  recordFailure,
  clearAttempts,
  formatRetryAfter,
} from "@/lib/auth/attemptLimiter";
import { getDeviceToken } from "@/lib/storage/deviceToken";
import { bindDeviceQuotesToUser } from "@/lib/supabase/quotes-api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    options?: { acceptedTerms: boolean }
  ) => Promise<{ error: string | null }>;
  signIn: (
    email: string,
    password: string,
    options?: { rememberMe: boolean }
  ) => Promise<{ error: string | null }>;
  signInGoogle: () => Promise<{ error: string | null }>;
  sendMagicLink: (email: string) => Promise<{ error: string | null }>;
  logout: () => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  setNewPassword: (newPassword: string) => Promise<{ error: string | null }>;
  updateOwnPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ error: string | null }>;
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
    // Enforce Remember Me: if user opted out and the browser has restarted,
    // drop the persisted session before surfacing any user state.
    const boot = async () => {
      if (shouldExpireOnBoot()) {
        await signOut();
        clearRememberMe();
        setUser(null);
        setLoading(false);
        return;
      }
      markSessionActive();
      const u = await getCurrentUser();
      setUser(u);
      setLoading(false);
    };
    boot();

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

  const signUp = useCallback(async (
    email: string,
    password: string,
    options?: { acceptedTerms: boolean }
  ) => {
    if (!options?.acceptedTerms) {
      return { error: "Please accept the Terms of Service and Privacy Policy to continue." };
    }
    const strength = validatePassword(password);
    if (!strength.valid) {
      return {
        error: `Password needs: ${strength.errors.join(", ").toLowerCase()}.`,
      };
    }
    const gate = checkAttempt("signup", email);
    if (!gate.allowed) {
      return {
        error: `Too many attempts. Try again in ${formatRetryAfter(gate.retryAfterSeconds)}.`,
      };
    }
    const { user: newUser, error } = await signUpWithEmail(email, password);
    if (error) {
      recordFailure("signup", email);
      return { error: toFriendlyAuthError(error) };
    }
    clearAttempts("signup", email);
    // New accounts default to Remember Me on.
    setRememberMe(true);
    if (newUser) {
      setUser(newUser);
      await bindLocalQuotesToUser(newUser.id);
    }
    return { error: null };
  }, [bindLocalQuotesToUser]);

  const signIn = useCallback(async (
    email: string,
    password: string,
    options?: { rememberMe: boolean }
  ) => {
    const gate = checkAttempt("signin", email);
    if (!gate.allowed) {
      return {
        error: `Too many failed attempts. Try again in ${formatRetryAfter(gate.retryAfterSeconds)}.`,
      };
    }
    const { user: newUser, error } = await signInWithEmail(email, password);
    if (error) {
      const status = recordFailure("signin", email);
      const friendly = toFriendlyAuthError(error);
      if (!status.allowed) {
        return {
          error: `Too many failed attempts. Try again in ${formatRetryAfter(status.retryAfterSeconds)}.`,
        };
      }
      if (status.attemptsRemaining <= 2) {
        return {
          error: `${friendly} ${status.attemptsRemaining} attempt${status.attemptsRemaining === 1 ? "" : "s"} left.`,
        };
      }
      return { error: friendly };
    }
    clearAttempts("signin", email);
    setRememberMe(options?.rememberMe ?? true);
    if (newUser) {
      setUser(newUser);
      await bindLocalQuotesToUser(newUser.id);
    }
    return { error: null };
  }, [bindLocalQuotesToUser]);

  const signInGoogle = useCallback(async () => {
    // OAuth redirect; default to Remember Me so the session survives the round trip.
    setRememberMe(true);
    const { error } = await signInWithGoogle();
    return { error };
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const gate = checkAttempt("magic", email);
    if (!gate.allowed) {
      return {
        error: `Too many requests. Try again in ${formatRetryAfter(gate.retryAfterSeconds)}.`,
      };
    }
    // The email will redirect to /auth/callback; mark Remember Me so the
    // exchanged session persists as expected after the round trip.
    setRememberMe(true);
    const { error } = await signInWithMagicLink(email);
    if (error) {
      recordFailure("magic", email);
      return { error: toFriendlyAuthError(error) };
    }
    recordFailure("magic", email);
    return { error: null };
  }, []);

  const logout = useCallback(async () => {
    const { error } = await signOut();
    if (!error) {
      clearRememberMe();
      setUser(null);
    }
    return { error: toFriendlyAuthError(error) };
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const gate = checkAttempt("reset", email);
    if (!gate.allowed) {
      return {
        error: `Too many requests. Try again in ${formatRetryAfter(gate.retryAfterSeconds)}.`,
      };
    }
    const { error } = await sendPasswordResetEmail(email);
    if (error) {
      recordFailure("reset", email);
      return { error: toFriendlyAuthError(error) };
    }
    recordFailure("reset", email);
    return { error: null };
  }, []);

  const setNewPassword = useCallback(async (newPassword: string) => {
    const strength = validatePassword(newPassword);
    if (!strength.valid) {
      return {
        error: `Password needs: ${strength.errors.join(", ").toLowerCase()}.`,
      };
    }
    const { error } = await updatePassword(newPassword);
    return { error: toFriendlyAuthError(error) };
  }, []);

  const updateOwnPassword = useCallback(async (
    currentPassword: string,
    newPassword: string
  ) => {
    if (currentPassword === newPassword) {
      return { error: "New password must be different from the current password." };
    }
    const strength = validatePassword(newPassword);
    if (!strength.valid) {
      return {
        error: `Password needs: ${strength.errors.join(", ").toLowerCase()}.`,
      };
    }
    const { error } = await changePassword(currentPassword, newPassword);
    return { error: error ? toFriendlyAuthError(error) : null };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signInGoogle,
        sendMagicLink,
        logout,
        requestPasswordReset,
        setNewPassword,
        updateOwnPassword,
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
