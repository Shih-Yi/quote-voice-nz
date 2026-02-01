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

// Bind quotes to user after registration/login
export async function bindQuotesToUser(
  ownerTokens: string[],
  userId: string
): Promise<{ count: number; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { count: 0, error: "Supabase not configured" };
  }

  if (ownerTokens.length === 0) {
    return { count: 0, error: null };
  }

  try {
    const { data, error } = await supabase.rpc("bind_quotes_to_user", {
      p_owner_tokens: ownerTokens,
      p_user_id: userId,
    });

    if (error) {
      console.error("Bind quotes error:", error);
      return { count: 0, error: error.message };
    }

    return { count: data || 0, error: null };
  } catch (err) {
    console.error("Bind quotes exception:", err);
    return { count: 0, error: "Failed to bind quotes" };
  }
}

// Listen for auth state changes
export function onAuthStateChange(
  callback: (user: User | null) => void
): (() => void) | undefined {
  const supabase = getSupabase();
  if (!supabase) return undefined;

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      callback(session?.user ?? null);
    }
  );

  return () => subscription.unsubscribe();
}
