"use client";

import { type ReactNode, useEffect } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { initSentry } from "@/lib/sentry";

function useServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      }).catch(() => {});
      caches?.keys?.().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration failed — app still works without it
    });
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    initSentry();
  }, []);
  useServiceWorker();
  return <AuthProvider>{children}</AuthProvider>;
}
