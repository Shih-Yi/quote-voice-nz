"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { validatePassword } from "@/lib/auth/passwordValidation";

const STRENGTH_BAR_COLOURS = [
  "bg-red-500",
  "bg-red-400",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-emerald-500",
] as const;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { user, loading: authLoading, setNewPassword } = useAuth();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => validatePassword(password), [password]);

  useEffect(() => {
    if (!authLoading && !user) {
      const t = setTimeout(() => {
        if (!user) {
          setError(
            "Your reset link has expired or is invalid. Request a new one from the sign-in screen."
          );
        }
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [authLoading, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!strength.valid) {
      setError(`Password needs: ${strength.errors.join(", ").toLowerCase()}.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await setNewPassword(password);
      if (result.error) {
        setError(result.error);
      } else {
        setDone(true);
        setTimeout(() => router.replace("/dashboard"), 1800);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-bg">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-border p-6 space-y-4">
        <h1 className="text-xl font-semibold text-center">Set a new password</h1>

        {done ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg text-center">
            Password updated. Redirecting you to your dashboard...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                disabled={submitting}
              />
              {password.length > 0 && (
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

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                disabled={submitting}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={submitting || !user}>
              {submitting ? "Updating..." : "Update Password"}
            </Button>

            {!user && !authLoading && (
              <p className="text-xs text-text-muted text-center">
                Waiting for reset session... if this persists, request a new link.
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
