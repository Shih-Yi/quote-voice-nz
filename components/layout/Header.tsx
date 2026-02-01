"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  pendingCount?: number;
  showLogin?: boolean;
  maxWidth?: string;
}

export function Header({ 
  pendingCount = 0, 
  showLogin = false,
  maxWidth = "max-w-2xl"
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3">
      <div className={`${maxWidth} mx-auto flex items-center justify-between`}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">KQ</span>
          </div>
          <span className="font-semibold text-text hidden sm:inline">KiwiSpeakQuote</span>
        </Link>

        <div className="flex items-center gap-4">
          {pendingCount > 0 && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
              {pendingCount} pending
            </Badge>
          )}

          {showLogin && (
            <Link href="/dashboard">
              <Button variant="ghost" className="text-primary hover:text-primary-dark font-medium">
                Login
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
