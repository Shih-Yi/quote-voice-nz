import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const cookieStore = await cookies();

      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        db: { schema: "api" },
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      });

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        const user = data.user;
        if (user) {
          const meta = user.user_metadata ?? {};
          const fullName =
            (meta.full_name as string | undefined) ??
            (meta.name as string | undefined) ??
            null;
          const avatarUrl =
            (meta.avatar_url as string | undefined) ??
            (meta.picture as string | undefined) ??
            null;
          const provider =
            (data.session?.user?.app_metadata?.provider as string | undefined) ??
            "unknown";

          const { data: existing } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", user.id)
            .maybeSingle();

          const isFirstTime = !existing;

          console.log("[auth/callback] profile sync", {
            userId: user.id,
            email: user.email,
            provider,
            isFirstTime,
            fullName,
            hasAvatar: Boolean(avatarUrl),
          });

          const { error: upsertError } = await supabase.from("profiles").upsert(
            {
              id: user.id,
              full_name: fullName,
              avatar_url: avatarUrl,
              email: user.email ?? null,
            },
            { onConflict: "id", ignoreDuplicates: false }
          );

          if (upsertError) {
            console.error("[auth/callback] profile upsert failed:", upsertError);
          } else if (isFirstTime) {
            console.log("[auth/callback] first-time profile created", {
              userId: user.id,
              email: user.email,
              fullName,
            });
          } else {
            console.log("[auth/callback] profile refreshed for existing user", {
              userId: user.id,
            });
          }
        }

        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }

      console.error("[auth/callback] exchangeCodeForSession failed:", error);
    }
  }

  // Redirect to home on error
  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
