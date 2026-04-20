/**
 * Remember Me strategy:
 * - rememberMe=true  → persist across browser restarts (default Supabase behaviour).
 * - rememberMe=false → session should end when the browser closes.
 *
 * Supabase persists sessions in localStorage. We emulate "session-only" mode by
 * marking the active tab in sessionStorage; when the browser restarts, the
 * sessionStorage marker is gone and we force a sign-out on app boot.
 */

const REMEMBER_ME_KEY = "ksq-remember-me";
const SESSION_ACTIVE_KEY = "ksq-session-active";

export function setRememberMe(remember: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REMEMBER_ME_KEY, remember ? "true" : "false");
  // Mark current tab as active so the next page load in this browser session
  // is recognised as a continuation, not a fresh restart.
  sessionStorage.setItem(SESSION_ACTIVE_KEY, "1");
}

export function markSessionActive(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_ACTIVE_KEY, "1");
}

export function clearRememberMe(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REMEMBER_ME_KEY);
  sessionStorage.removeItem(SESSION_ACTIVE_KEY);
}

/**
 * Returns true if the stored session should be considered expired on boot
 * because the user opted out of Remember Me and the browser has restarted.
 */
export function shouldExpireOnBoot(): boolean {
  if (typeof window === "undefined") return false;
  const remember = localStorage.getItem(REMEMBER_ME_KEY);
  if (remember !== "false") return false;
  const active = sessionStorage.getItem(SESSION_ACTIVE_KEY);
  return active !== "1";
}
