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
import { clearAllLocalData } from "@/lib/storage/cleanup";
import { getSyncQueue } from "@/lib/storage/quotes";
import { getPendingCount } from "@/lib/storage/pending";
import { hydrateUserQuotesFromCloud } from "@/lib/storage/hydrate";

// Event fired after IndexedDB is updated from the cloud so list/dashboard
// pages can re-read local storage without polling.
export const QUOTES_CHANGED_EVENT = "ksq:quotes-changed";

function emitQuotesChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(QUOTES_CHANGED_EVENT));
  } catch {
    // Non-fatal — older browsers / SSR.
  }
}

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

// Persisted across reloads so bindDeviceQuotesToUser runs only once per user
// per device. Cleared on logout / SIGNED_OUT.
const BOUND_USER_KEY = "ksq:bound_user_id";

function clearBoundUserId() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(BOUND_USER_KEY);
  } catch {
    // Ignore — non-fatal.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Pull cloud quotes into IndexedDB. Runs after bind so newly-claimed anon
  // rows are included, and on boot when a session exists so cleared-local /
  // cross-device users see their quotes again.
  const hydrateAndNotify = useCallback(async () => {
    try {
      const result = await hydrateUserQuotesFromCloud();
      if (result.error) {
        console.warn("[Auth] Hydrate failed:", result.error);
        return;
      }
      if (result.added > 0 || result.updated > 0) {
        emitQuotesChanged();
      }
    } catch (err) {
      console.error("[Auth] Hydrate exception:", err);
    }
  }, []);

  // Bind all device quotes to the user (single device token), then hydrate
  // the user's full quote list from the cloud into IndexedDB.
  // Dedup key is persisted in localStorage so we don't re-bind on every reload,
  // but hydrate still runs because the local copy may be stale or empty.
  // Cleared on SIGNED_OUT / logout so new anon quotes created in a logged-out
  // window can still be claimed by the next sign-in.
  const bindLocalQuotesToUser = useCallback(async (userId: string) => {
    if (typeof window === "undefined") return;

    let alreadyBound = false;
    try {
      alreadyBound = window.localStorage.getItem(BOUND_USER_KEY) === userId;
    } catch {
      // localStorage unavailable (private mode) — fall through and bind.
    }

    if (!alreadyBound) {
      try {
        const deviceToken = await getDeviceToken();
        const result = await bindDeviceQuotesToUser(deviceToken, userId);
        if (result.error) {
          console.error("[Auth] Bind error:", result.error);
        } else {
          try {
            window.localStorage.setItem(BOUND_USER_KEY, userId);
          } catch {
            // Non-fatal: bind succeeded, we'll just retry next reload.
          }
        }
      } catch (err) {
        console.error("[Auth] Failed to bind quotes:", err);
      }
    }

    await hydrateAndNotify();
  }, [hydrateAndNotify]);

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
      // Already-signed-in session on page load (refresh / reopen): hydrate
      // cloud quotes into IndexedDB. INITIAL_SESSION won't trigger the bind
      // path below, so we do it here. Bind itself is skipped — there are no
      // anonymous-on-this-device quotes to claim on a cold boot.
      if (u) {
        hydrateAndNotify();
      }
    };
    boot();

    // Listen for auth changes. Only bind on real SIGNED_IN events — ignore
    // INITIAL_SESSION (page load/refresh) and TOKEN_REFRESHED (hourly renewal)
    // to avoid hammering /api/quotes/bind.
    const unsubscribe = onAuthStateChange((event, newUser) => {
      setUser(newUser);

      if (event === "SIGNED_OUT" || !newUser) {
        clearBoundUserId();
        return;
      }

      if (event === "SIGNED_IN") {
        bindLocalQuotesToUser(newUser.id);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [bindLocalQuotesToUser, hydrateAndNotify]);

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
    const { error } = await signUpWithEmail(email, password);
    if (error) {
      recordFailure("signup", email);
      return { error: toFriendlyAuthError(error) };
    }
    clearAttempts("signup", email);
    // New accounts default to Remember Me on.
    setRememberMe(true);
    // setUser + bind are handled by onAuthStateChange(SIGNED_IN) — single entry point.
    return { error: null };
  }, []);

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
    const { error } = await signInWithEmail(email, password);
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
    // setUser + bind are handled by onAuthStateChange(SIGNED_IN) — single entry point.
    return { error: null };
  }, []);

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
    // Warn if anything local hasn't made it to the cloud yet. Clearing
    // IndexedDB on sign-out is how we prevent the next user on this device
    // from seeing the previous user's data, but it also means un-synced
    // work is gone for good.
    if (typeof window !== "undefined") {
      const [pendingAudio, unsyncedQuotes] = await Promise.all([
        getPendingCount(),
        getSyncQueue().then((q) => q.length),
      ]);
      const unsyncedTotal = pendingAudio + unsyncedQuotes;
      if (unsyncedTotal > 0) {
        const proceed = window.confirm(
          `You have ${unsyncedTotal} unsynced ${unsyncedTotal === 1 ? "item" : "items"} ` +
            `(recordings or quote edits). Signing out will delete them from this device. Continue?`
        );
        if (!proceed) {
          return { error: null };
        }
      }
    }

    const { error } = await signOut();
    if (error) {
      return { error: toFriendlyAuthError(error) };
    }

    clearRememberMe();
    clearBoundUserId();

    // Wipe all local app state — IndexedDB (quotes, queues, pending audio,
    // device token) and known localStorage keys. A fresh device token will
    // be minted lazily on the next getDeviceToken() call, so the next user
    // cannot inherit the previous user's cloud access.
    await clearAllLocalData();

    setUser(null);
    return { error: null };
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
