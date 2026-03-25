"use client";

import { useState, useEffect } from "react";
import { UserProfile } from "@/types/quote";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { getStoredProviderDetails, saveProviderDetailsToStorage } from "@/lib/storage/provider";
import { getSupabase } from "@/lib/supabase/client";
import { ChevronDown, ChevronUp, Store, Phone, Mail } from "lucide-react";

interface ProviderInfoProps {
  providerDetails?: UserProfile;
  onChange: (details: UserProfile) => void;
  onUpdateProfile?: (update: boolean) => void;
  onShowAuthModal?: () => void;
  readOnly?: boolean;
}

export function ProviderInfo({ providerDetails, onChange, onUpdateProfile, onShowAuthModal, readOnly = false }: ProviderInfoProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [updateDefault, setUpdateDefault] = useState(false);
  
  // Local state for editing fields
  const [localDetails, setLocalDetails] = useState<UserProfile>(providerDetails || {});

  // Notify parent of checkbox change
  const handleCheckboxChange = (checked: boolean) => {
    setUpdateDefault(checked);
    onUpdateProfile?.(checked);
  };

  // Initialize: Load defaults if empty
  useEffect(() => {
    const hasDetails = providerDetails && (providerDetails.businessName || providerDetails.phone);
    if (hasDetails) {
        setLocalDetails(providerDetails);
        return;
    }

    const loadDefaults = async () => {
      let defaults: Partial<UserProfile> = {};

      if (user) {
        // Logged in: Try to fetch profile
        const supabase = getSupabase();
        if (!supabase) return;
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        
        if (data) {
          defaults = {
            businessName: data.business_name,
            phone: data.phone,
            email: data.email,
            address: data.address,
            bankAccount: data.bank_account,
          };
        }
      } else {
        // Anon: Load from local storage
        defaults = getStoredProviderDetails();
      }

      if (Object.keys(defaults).length > 0) {
        const newDetails = { ...localDetails, ...defaults };
        setLocalDetails(newDetails);
        onChange(newDetails); // Push up to QuoteForm
      } else {
        // No defaults found, probably first time -> expand form
        setIsExpanded(true);
      }
    };

    loadDefaults();
  }, [user]); // Run on mount or auth change

  // Handle Input Change
  const handleChange = (field: keyof UserProfile, value: string) => {
    const updated = { ...localDetails, [field]: value };
    setLocalDetails(updated);
    onChange(updated);

    // If anon, save to local storage (auto-save)
    if (!user) {
      saveProviderDetailsToStorage(updated);
    }
  };

  if (readOnly) {
    if (!localDetails.businessName) return null;
    return (
        <div className="mb-6 p-4 bg-white rounded-lg border border-border">
            <h3 className="font-semibold text-lg">{localDetails.businessName}</h3>
            {localDetails.phone && <p className="text-text-muted">{localDetails.phone}</p>}
        </div>
    );
  }

  const hasName = !!localDetails.businessName;

  return (
    <Card className="mb-4 bg-slate-50 border-dashed border-2 shadow-none">
      <CardContent className="p-0">
        {/* Header / Summary View */}
        <div 
            className="p-4 flex items-center justify-between cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-primary">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-medium text-text">
                {hasName ? localDetails.businessName : "Your Business Details"}
              </h3>
              <p className="text-xs text-text-muted">
                {hasName ? "Click to edit" : "Tap to set up your quote header"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {/* Expanded Edit View */}
        {isExpanded && (
          <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
            <Separator className="mb-4" />
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="bizName" className="text-xs">Business Name</Label>
                <div className="relative">
                    <Store className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="bizName" 
                        value={localDetails.businessName || ""} 
                        onChange={(e) => handleChange("businessName", e.target.value)}
                        placeholder="e.g. Kiwi Plumbing Ltd"
                        className="pl-9"
                    />
                </div>
              </div>

              <div>
                <Label htmlFor="bizPhone" className="text-xs">Phone</Label>
                <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="bizPhone" 
                        value={localDetails.phone || ""} 
                        onChange={(e) => handleChange("phone", e.target.value)}
                        placeholder="021 123 4567"
                        className="pl-9"
                        type="tel"
                        inputMode="tel"
                    />
                </div>
              </div>

              <div>
                <Label htmlFor="bizEmail" className="text-xs">Email (Optional)</Label>
                <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        id="bizEmail" 
                        value={localDetails.email || ""} 
                        onChange={(e) => handleChange("email", e.target.value)}
                        placeholder="quotes@example.com"
                        className="pl-9"
                        type="email"
                        inputMode="email"
                    />
                </div>
              </div>
              {/* "Sick of typing" Prompt for Anon Users */}
              {!user && (localDetails.businessName || localDetails.phone) && (
                <div className="mt-4 p-3 bg-indigo-50 rounded-md border border-indigo-100 flex flex-col gap-2">
                    <p className="text-xs text-indigo-800">
                        <strong>Sick of typing this?</strong><br/>
                        Create a free account to save your business details forever.
                    </p>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 h-8 text-xs"
                        onClick={onShowAuthModal}
                    >
                        Create Account / Login
                    </Button>
                </div>
              )}

              {/* Update Default Profile Checkbox for Logged-in Users */}
              {user && (
                <div className="flex items-center space-x-2 mt-4 pt-2 border-t border-dashed">
                  <input
                    type="checkbox"
                    id="updateDefault"
                    checked={updateDefault}
                    onChange={(e) => handleCheckboxChange(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label 
                    htmlFor="updateDefault" 
                    className="text-xs text-text-muted cursor-pointer font-normal"
                  >
                    Save these changes to my default profile
                  </Label>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}