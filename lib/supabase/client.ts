import { createClient, SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiSupabaseClient = SupabaseClient<any, "api", any>;

let supabaseInstance: ApiSupabaseClient | null = null;

export function getSupabase(): ApiSupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        db: {
          schema: "api",  // Use Dedicated API Schema
        },
      }
    );
  }

  return supabaseInstance;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
