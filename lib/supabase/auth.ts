import { getSupabase } from "./client";
import type { User, Session } from "@supabase/supabase-js";

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

// Get current user
export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Get current session
export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Sign up with email
export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { user: null, error: "Supabase not configured" };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { user: null, error: error.message };
  }

  return { user: data.user, error: null };
}

// Sign in with email
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { user: null, error: "Supabase not configured" };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { user: null, error: error.message };
  }

  return { user: data.user, error: null };
}

// Sign in with Google
export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { error: "Supabase not configured" };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// Sign in with Magic Link (passwordless)
export async function signInWithMagicLink(
  email: string
): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { error: "Supabase not configured" };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// Change password for an authenticated user (verifies current password first)
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { error: "Supabase not configured" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "You must be signed in with an email account" };
  }

  // Re-authenticate to verify current password
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (verifyError) {
    return { error: "Current password is incorrect" };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// Send password reset email
export async function sendPasswordResetEmail(
  email: string
): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { error: "Supabase not configured" };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// Update password (for authenticated user, typically after reset link)
export async function updatePassword(
  newPassword: string
): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { error: "Supabase not configured" };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// Sign out
export async function signOut(): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { error: "Supabase not configured" };
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

// Supabase auth event types we care about. See:
// https://supabase.com/docs/reference/javascript/auth-onauthstatechange
export type AuthChangeEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY";

// Listen for auth state changes. Exposes the event type so callers can
// distinguish INITIAL_SESSION / TOKEN_REFRESHED from a real SIGNED_IN.
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, user: User | null) => void
): (() => void) | undefined {
  const supabase = getSupabase();
  if (!supabase) return undefined;

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(event as AuthChangeEvent, session?.user ?? null);
    }
  );

  return () => subscription.unsubscribe();
}
