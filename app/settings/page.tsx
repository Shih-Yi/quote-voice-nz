"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, updateUserProfile } from "@/lib/supabase/profile";
import { UserProfile } from "@/types/quote";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { ChangePasswordCard } from "@/components/auth/ChangePasswordCard";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/");
      return;
    }

    const loadProfile = async () => {
      setIsLoading(true);
      const data = await getUserProfile(user.id);
      if (data) {
        setProfile(data);
      }
      setIsLoading(false);
    };

    loadProfile();
  }, [user, authLoading, router]);

  const handleChange = (field: keyof UserProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    const { success, error } = await updateUserProfile(user.id, profile);
    setIsSaving(false);

    if (success) {
      toast.success("Settings saved successfully");
    } else {
      toast.error(error || "Failed to save settings");
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null; // Should redirect in useEffect

  return (
    <div className="min-h-screen bg-bg flex flex-col font-sans">
      <Header />
      
      <main className="flex-1 container max-w-2xl mx-auto px-4 py-6">
        <div className="mb-6">
          <Link href="/dashboard" className="inline-flex items-center text-sm text-text-muted hover:text-primary mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-text mb-2">Business Settings</h1>
          <p className="text-text-muted">
            Manage your default business details. These will be automatically applied to new quotes.
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Profile</CardTitle>
              <CardDescription>
                Your standard contact information for quotes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Name</Label>
                <Input
                  id="fullName"
                  value={profile.fullName || ""}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  placeholder="e.g. Mike Smith"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={profile.businessName || ""}
                  onChange={(e) => handleChange("businessName", e.target.value)}
                  placeholder="e.g. Kiwi Plumbing Ltd"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profile.phone || ""}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="021 123 4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email || ""}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="quotes@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={profile.address || ""}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="123 Main St, Suburb, City"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Financial Details</CardTitle>
              <CardDescription>
                Payment information to display on your quotes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bankAccount">Bank Account (NZ Format)</Label>
                <Input
                  id="bankAccount"
                  value={profile.bankAccount || ""}
                  onChange={(e) => handleChange("bankAccount", e.target.value)}
                  placeholder="XX-XXXX-XXXXXXX-XX"
                  className="font-mono"
                />
                <p className="text-xs text-text-muted">
                  Standard NZ format: 2 digits - 4 digits - 7 digits - 2 or 3 digits suffix
                </p>
              </div>
            </CardContent>
          </Card>

          <ChangePasswordCard />

          <div className="sticky bottom-4 z-10">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full md:w-auto shadow-lg bg-primary hover:bg-primary-dark"
              size="lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
