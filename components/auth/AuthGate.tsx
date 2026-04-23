"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineStorage } from "@/hooks/useOfflineStorage";
import { on, emit, KSQ_EVENTS } from "@/lib/events";

// Top-level gate that reacts to auth-required events (e.g. anon quota hit on
// /api/transcribe) and auto-replays pending audio after successful sign-in.
// Mounted once in Providers so every page gets the behaviour without
// per-page wiring.
export function AuthGate() {
  const { user, signUp, signIn, signInGoogle } = useAuth();
  const { syncAll, refreshPending } = useOfflineStorage();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Track whether we opened the modal because of a quota gate. If so, auto
  // sync pending audio on SIGNED_IN. Cleared once we've consumed it.
  const autoSyncOnLoginRef = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = on(KSQ_EVENTS.AUTH_REQUIRED, () => {
      if (user) return; // Already signed in — nothing to gate.
      autoSyncOnLoginRef.current = true;
      setShowAuthModal(true);
    });
    return unsubscribe;
  }, [user]);

  // Auto-replay pending audio after login following a quota-gated flow.
  useEffect(() => {
    const prev = prevUserIdRef.current;
    const curr = user?.id ?? null;
    prevUserIdRef.current = curr;

    if (!curr || prev === curr) return;
    if (!autoSyncOnLoginRef.current) return;

    autoSyncOnLoginRef.current = false;
    setShowAuthModal(false);

    (async () => {
      const { successCount, failCount, lastError } = await syncAll();
      await refreshPending();
      emit(KSQ_EVENTS.PENDING_SYNCED, { successCount, failCount });

      if (successCount > 0) {
        toast.success(
          `Synced ${successCount} pending ${successCount === 1 ? "recording" : "recordings"}`
        );
      } else if (failCount > 0) {
        toast.error(`Sync failed: ${lastError ?? "Unknown error"}`);
      }
    })();
  }, [user, syncAll, refreshPending]);

  return (
    <AuthModal
      open={showAuthModal}
      onOpenChange={(open) => {
        setShowAuthModal(open);
        if (!open) autoSyncOnLoginRef.current = false;
      }}
      onSignUp={signUp}
      onSignIn={signIn}
      onSignInGoogle={signInGoogle}
    />
  );
}
