import { clear } from "idb-keyval";
import { clearStoredProviderDetails } from "./provider";

// LocalStorage keys this app owns. Kept explicit (vs localStorage.clear()) so
// we don't nuke unrelated data (analytics cookies set by third parties, etc).
const APP_LOCAL_STORAGE_KEYS = [
  "ksq_provider_details",
  "ksq:bound_user_id",
  "ksq:remember_me",
  "ksq:session_active",
];

// Wipe all client-side app state. Called on sign-out so the next user on the
// same device starts fresh and can't see the previous user's local quotes.
//
// This clears:
//   - All IndexedDB keyval entries (quotes, sync queues, pending audio, device
//     token — the token is intentionally cleared so getDeviceToken() will
//     mint a fresh one on next call, preventing cloud access bleed-through)
//   - Known localStorage keys
export async function clearAllLocalData(): Promise<void> {
  try {
    await clear();
  } catch (err) {
    console.error("[clearAllLocalData] IndexedDB clear failed:", err);
  }

  try {
    clearStoredProviderDetails();
    if (typeof window !== "undefined") {
      for (const key of APP_LOCAL_STORAGE_KEYS) {
        window.localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.error("[clearAllLocalData] localStorage clear failed:", err);
  }
}
