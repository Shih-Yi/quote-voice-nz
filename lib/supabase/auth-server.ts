import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

/**
 * Get the current authenticated user from cookies in API routes / Server Components.
 * Uses anon key + cookie-based JWT (NOT service_role) so RLS policies apply.
 * Same pattern as middleware.ts and auth/callback/route.ts.
 */
export async function getCurrentUserServer(): Promise<User | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll can throw in read-only contexts (e.g. middleware).
          // Safe to ignore — the token refresh will succeed on the next request.
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
