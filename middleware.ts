import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { globalIpRateLimit } from "@/lib/rateLimit";

// Routes that require an authenticated session.
// Dashboard, quotes, and revenue use IndexedDB — no login needed for free tier.
const PROTECTED_PREFIXES = ["/settings", "/admin"];

// API paths that must NOT be rate-limited here.
// Stripe webhook retries need to be delivered even under burst load; they
// authenticate themselves via signature verification.
const API_RATE_LIMIT_SKIP = ["/api/webhooks/"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function shouldRateLimitApi(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  return !API_RATE_LIMIT_SKIP.some((prefix) => pathname.startsWith(prefix));
}

async function enforceApiRateLimit(
  request: NextRequest
): Promise<NextResponse | null> {
  // Coarse first line of defence: 120 requests/min per IP across all API.
  // Tighter per-route limits still apply inside each route handler.
  try {
    return await globalIpRateLimit(request, { limit: 120, windowSeconds: 60 });
  } catch (error) {
    console.error("[middleware] Rate limiting unexpected error:", error);
    return null;
  }
}

async function enforceAuthRedirect(
  request: NextRequest
): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured (local dev without env vars), let traffic through.
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // getUser() validates the JWT against Supabase — safe against spoofing.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/";
    loginUrl.searchParams.set("auth", "login");
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldRateLimitApi(pathname)) {
    const limited = await enforceApiRateLimit(request);
    if (limited) return limited;
    return NextResponse.next();
  }

  if (isProtected(pathname)) {
    return enforceAuthRedirect(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match:
     *  - all API routes (for global IP rate limiting)
     *  - all page routes except static assets (for auth redirects on
     *    PROTECTED_PREFIXES; other pages pass through cheaply).
     */
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico|manifest|icons|robots.txt|api/).*)",
  ],
};
