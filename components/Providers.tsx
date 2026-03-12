"use client";

import { type ReactNode, useEffect } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";

function useServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // SW registration failed — app still works without it
      });
    }
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  useServiceWorker();
  return <AuthProvider>{children}</AuthProvider>;
}
