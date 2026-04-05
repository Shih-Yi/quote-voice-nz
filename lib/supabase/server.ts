import { createClient, SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiSupabaseClient = SupabaseClient<any, "api", any>;

let serverInstance: ApiSupabaseClient | null = null;

/**
 * Server-side Supabase client using service_role key.
 * Bypasses RLS — use only in API routes, never in client code.
 */
export function getServerSupabase(): ApiSupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  if (!serverInstance) {
    serverInstance = createClient(url, serviceKey, {
      db: { schema: "api" },
      auth: { persistSession: false },
    });
  }

  return serverInstance;
}
