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
// ...
// ...
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