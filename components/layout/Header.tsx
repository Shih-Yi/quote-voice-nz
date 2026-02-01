"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/hooks/useAuth";

interface HeaderProps {
  pendingCount?: number;
  maxWidth?: string;
}

export function Header({
  pendingCount = 0,
  maxWidth = "max-w-2xl"
}: HeaderProps) {
  const { user, loading, logout, signUp, signIn, signInGoogle } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-border px-4 py-3">
        <div className={`${maxWidth} mx-auto flex items-center justify-between`}>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">KQ</span>
            </div>
            <span className="font-semibold text-text hidden sm:inline">KiwiSpeakQuote</span>
          </Link>

          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                {pendingCount} pending
              </Badge>
            )}

            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center gap-2">
                    {/* User indicator */}
                    <div className="flex items-center gap-2 text-sm text-text-muted">
                      <div className="w-8 h-8 bg-secondary/20 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="hidden sm:inline max-w-[120px] truncate">
                        {user.email}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      className="text-text-muted hover:text-text"
                    >
                      Logout
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAuthModal(true)}
                    className="text-primary hover:text-primary-dark"
                  >
                    Login
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onSignUp={signUp}
        onSignIn={signIn}
        onSignInGoogle={signInGoogle}
      />
    </>
  );
}
