"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { validatePassword } from "@/lib/auth/passwordValidation";

const STRENGTH_BAR_COLOURS = [
  "bg-red-500",
  "bg-red-400",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-emerald-500",
] as const;

export function ChangePasswordCard() {
  const { user, updateOwnPassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const strength = useMemo(() => validatePassword(newPassword), [newPassword]);

  // Google-only users have no password to change; hide the card entirely.
  const isEmailAccount = Boolean(user?.email && user.app_metadata?.provider === "email");
  if (!isEmailAccount) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword) {
      toast.error("Please fill in both password fields");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    if (!strength.valid) {
      toast.error(`Password needs: ${strength.errors.join(", ").toLowerCase()}`);
      return;
    }

    setSubmitting(true);
    const { error } = await updateOwnPassword(currentPassword, newPassword);
    setSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Password updated");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5" />
          Change Password
        </CardTitle>
        <CardDescription>
          Update the password you use to sign in with email.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              disabled={submitting}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              disabled={submitting}
              minLength={8}
              required
            />
            {newPassword.length > 0 && (
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
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={submitting}
              minLength={8}
              required
            />
          </div>

          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
