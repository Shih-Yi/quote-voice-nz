"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { validatePassword } from "@/lib/auth/passwordValidation";
import { useAuth } from "@/hooks/useAuth";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
  onSignUp: (
    email: string,
    password: string,
    options?: { acceptedTerms: boolean }
  ) => Promise<{ error: string | null }>;
  onSignIn: (
    email: string,
    password: string,
    options?: { rememberMe: boolean }
  ) => Promise<{ error: string | null }>;
  onSignInGoogle: () => Promise<{ error: string | null }>;
}

type Mode = "signin" | "signup" | "forgot" | "magic";

const STRENGTH_BAR_COLOURS = [
  "bg-red-500",
  "bg-red-400",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-emerald-500",
] as const;

export function AuthModal({
  open,
  onOpenChange,
  defaultTab,
  onSignUp,
  onSignIn,
  onSignInGoogle,
}: AuthModalProps) {
  const { requestPasswordReset, sendMagicLink } = useAuth();
  const [mode, setMode] = useState<Mode>(defaultTab === "login" ? "signin" : "signup");

  useEffect(() => {
    if (defaultTab) {
      setMode(defaultTab === "login" ? "signin" : "signup");
    }
  }, [defaultTab]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => validatePassword(password), [password]);

  const resetFields = () => {
    setEmail("");
    setPassword("");
    setAcceptedTerms(false);
    setError(null);
    setInfo(null);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === "signup") {
      if (!acceptedTerms) {
        setError("Please agree to the Terms of Service and Privacy Policy.");
        return;
      }
      if (!strength.valid) {
        setError(`Password needs: ${strength.errors.join(", ").toLowerCase()}.`);
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "forgot") {
        const result = await requestPasswordReset(email);
        if (result.error) {
          setError(result.error);
        } else {
          setInfo(
            "If an account exists for this email, we've sent a reset link. Check your inbox."
          );
        }
        return;
      }

      if (mode === "magic") {
        const result = await sendMagicLink(email);
        if (result.error) {
          setError(result.error);
        } else {
          setInfo(
            "Check your inbox — we've sent you a one-tap sign-in link. It expires in 1 hour."
          );
        }
        return;
      }

      const result =
        mode === "signup"
          ? await onSignUp(email, password, { acceptedTerms })
          : await onSignIn(email, password, { rememberMe });

      if (result.error) {
        setError(result.error);
      } else {
        onOpenChange(false);
        resetFields();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const result = await onSignInGoogle();
      if (result.error) {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "signup"
      ? "Create Account"
      : mode === "forgot"
        ? "Reset Password"
        : mode === "magic"
          ? "Sign in with Magic Link"
          : "Welcome Back";

  const submitLabel =
    mode === "signup"
      ? loading
        ? "Creating..."
        : "Create Account"
      : mode === "forgot"
        ? loading
          ? "Sending..."
          : "Send Reset Link"
        : mode === "magic"
          ? loading
            ? "Sending..."
            : "Send Magic Link"
          : loading
            ? "Signing in..."
            : "Sign In";

  const showSocial = mode === "signin" || mode === "signup";
  const showPassword = mode === "signin" || mode === "signup";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {showSocial && (
            <>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>

              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-text-muted">
                  or
                </span>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>

            {showPassword && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={mode === "signup" ? 8 : 6}
                  disabled={loading}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />

                {mode === "signup" && password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded ${
                            i < strength.score
                              ? STRENGTH_BAR_COLOURS[strength.score]
                              : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-text-muted">
                      Strength: <span className="font-medium">{strength.label}</span>
                      {strength.errors.length > 0 && (
                        <>
                          {" — needs "}
                          {strength.errors.join(", ").toLowerCase()}
                        </>
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {mode === "signin" && (
              <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-border accent-primary"
                  disabled={loading}
                />
                Remember me on this device
              </label>
            )}

            {mode === "signup" && (
              <label className="flex items-start gap-2 text-sm text-text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border accent-primary"
                  disabled={loading}
                  required
                />
                <span>
                  I agree to the{" "}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="text-primary hover:underline"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="text-primary hover:underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
            )}
            {info && (
              <p className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg">
                {info}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {submitLabel}
                </span>
              ) : (
                submitLabel
              )}
            </Button>

            {mode === "signin" && (
              <button
                type="button"
                onClick={() => switchMode("magic")}
                className="w-full text-center text-sm text-primary hover:underline"
                disabled={loading}
              >
                Email me a sign-in link instead
              </button>
            )}
          </form>

          <p className="text-center text-sm text-text-muted">
            {mode === "signup" && (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="text-primary hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
            {mode === "signin" && (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="text-primary hover:underline"
                >
                  Create one
                </button>
              </>
            )}
            {(mode === "forgot" || mode === "magic") && (
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="text-primary hover:underline"
              >
                Back to sign in
              </button>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
