"use client";

import { ReactNode } from "react";
import { Header } from "./Header";

interface MobileShellProps {
  children: ReactNode;
  footer?: ReactNode;
  pendingCount?: number;
  hideHeader?: boolean;
}

export function MobileShell({
  children,
  footer,
  pendingCount = 0,
  hideHeader = false
}: MobileShellProps) {
  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {!hideHeader && <Header pendingCount={pendingCount} />}

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full px-4 py-4">
          {children}
        </div>
      </main>

      {footer && (
        <footer className="shrink-0 bg-white border-t border-border px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] z-10">
          <div className="max-w-2xl mx-auto">
            {footer}
          </div>
        </footer>
      )}
    </div>
  );
}
