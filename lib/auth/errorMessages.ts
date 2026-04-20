const ERROR_MAP: Array<{ match: RegExp; message: string }> = [
  {
    match: /invalid login credentials|invalid email or password/i,
    message: "That email or password doesn't match our records. Give it another go.",
  },
  {
    match: /email not confirmed/i,
    message: "Please confirm your email first — check your inbox for the link.",
  },
  {
    match: /user already registered|already registered|user exists/i,
    message: "An account with this email already exists. Try signing in instead.",
  },
  {
    match: /password should be at least|password.*too short/i,
    message: "Password is too short. Use at least 8 characters.",
  },
  {
    match: /weak password|password.*weak/i,
    message: "Password is too weak. Add an uppercase letter and a number.",
  },
  {
    match: /invalid email|email.*invalid/i,
    message: "That doesn't look like a valid email address.",
  },
  {
    match: /rate limit|too many requests/i,
    message: "Too many attempts. Take a breather and try again in a minute.",
  },
  {
    match: /network|fetch failed|failed to fetch/i,
    message: "Can't reach the server. Check your connection and try again.",
  },
  {
    match: /user not found/i,
    message: "No account found with that email.",
  },
  {
    match: /token.*expired|expired.*token|otp.*expired/i,
    message: "This link has expired. Please request a new one.",
  },
  {
    match: /same.*password|new password.*same/i,
    message: "New password must be different from the current one.",
  },
  {
    match: /supabase not configured/i,
    message: "Sign-in is temporarily unavailable. Please try again shortly.",
  },
];

export function toFriendlyAuthError(error: string | null | undefined): string | null {
  if (!error) return null;
  const trimmed = error.trim();
  for (const { match, message } of ERROR_MAP) {
    if (match.test(trimmed)) return message;
  }
  return "Something went wrong. Please try again.";
}
