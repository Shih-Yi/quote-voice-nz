// Boot-time guard: refuse to start a production deploy with missing env vars.
// Runs once per Lambda cold start, before any request is served, so a missing
// secret crashes the build/boot loudly instead of degrading silently at
// runtime (e.g. rate limiter falling back to per-instance in-memory state).
export async function register() {
  if (process.env.VERCEL_ENV !== "production") return;

  const required = [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "GROQ_API_KEY",
    "OPENAI_API_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[instrumentation] Missing required env vars: ${missing.join(", ")}`
    );
  }
}
