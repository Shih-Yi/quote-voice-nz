"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { MobileShell } from "@/components/layout/MobileShell";
import { QuoteForm } from "@/components/quote/QuoteForm";
import { QuotePreview } from "@/components/quote/QuotePreview";
import { QuotePDF } from "@/components/quote/QuotePDF";
import { QuoteShare } from "@/components/quote/QuoteShare";
import { EditSentQuoteDialog } from "@/components/quote/EditSentQuoteDialog";
import { RegisterPrompt } from "@/components/auth/RegisterPrompt";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { QuoteVersionDiff } from "@/components/quote/QuoteVersionDiff";
import { getQuoteById, getAllQuotes, updateQuote, deleteQuote, refreshQuoteFromCloud, markQuoteAsSent, duplicateQuote, unlockQuoteForEditing } from "@/lib/storage/quotes";
import { getVersionHistory } from "@/lib/utils/quoteVersions";
import { updateUserProfile } from "@/lib/supabase/profile";
import { useAuth } from "@/hooks/useAuth";
import type { Quote } from "@/types/quote";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function QuoteEditorPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showEditSentDialog, setShowEditSentDialog] = useState(false);
  const [showVersionDiff, setShowVersionDiff] = useState(false);
  const [versionHistory, setVersionHistory] = useState<Quote[]>([]);
  const { user, loading: authLoading, signUp, signIn, signInGoogle } = useAuth();

  useEffect(() => {
    async function loadQuote() {
      try {
        const id = resolvedParams.id;
        const data = await getQuoteById(id);
        if (data) {
          setQuote(data);
          // Auto-edit mode for drafts
          if (data.status === "draft") {
            setIsEditing(true);
          }
        }

        // Load version history
        const allQuotes = await getAllQuotes();
        const history = getVersionHistory(allQuotes, id);
        if (history.length > 1) {
          setVersionHistory(history);
        }

        // Background Refresh from Cloud
        try {
          const cloudData = await refreshQuoteFromCloud(id);
          if (cloudData) {
            // If local doesn't exist OR cloud is newer
            if (!data || new Date(cloudData.updatedAt) > new Date(data.updatedAt)) {
              setQuote(cloudData);
              toast.info("Quote updated from cloud");
            }
          }
        } catch (e) {
          console.error("Cloud sync check failed", e);
        }

      } catch (error) {
        console.error("Failed to load quote:", error);
        toast.error("Failed to load quote");
      } finally {
        setIsLoading(false);
      }
    }
    loadQuote();
  }, [resolvedParams.id]);

  const handleSave = useCallback(async (updatedQuote: Quote, updateProfile?: boolean) => {
    setIsSaving(true);
    try {
      // 1. Save the quote
      const result = await updateQuote(updatedQuote);
      if (result.error) {
        toast.error(result.error);
        setIsSaving(false);
        return;
      }

      // 2. Optionally update user profile (if logged in and checkbox checked)
      if (updateProfile && user && updatedQuote.providerDetails) {
        const profileResult = await updateUserProfile(user.id, updatedQuote.providerDetails);
        if (profileResult.success) {
            toast.success("Default profile settings updated!");
        } else {
            console.error("Failed to update profile", profileResult.error);
        }
      }

      setQuote(updatedQuote);
      setIsEditing(false);
      toast.success("Quote saved!");
    } catch (error) {
      console.error("Failed to save quote:", error);
      toast.error("Failed to save quote");
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const handleSend = useCallback(async () => {
    if (!quote) return;

    try {
      await markQuoteAsSent(quote.id);
      setQuote({ ...quote, status: "sent" });
      toast.success("Quote marked as sent!");
    } catch (error) {
      console.error("Failed to update quote:", error);
      toast.error("Failed to update quote");
    }
  }, [quote]);

  const handleDelete = useCallback(async () => {
    if (!quote) return;

    if (!confirm("Are you sure you want to delete this quote?")) {
      return;
    }

    try {
      await deleteQuote(quote.id);
      toast.success("Quote deleted");
      router.push("/");
    } catch (error) {
      console.error("Failed to delete quote:", error);
      toast.error("Failed to delete quote");
    }
  }, [quote, router]);

  // Handle edit button click - show dialog for sent quotes
  const handleEditClick = useCallback(() => {
    if (!quote) return;

    if (quote.status !== "draft") {
      // Show dialog for sent/accepted quotes
      setShowEditSentDialog(true);
    } else {
      // Direct edit for drafts
      setIsEditing(true);
    }
  }, [quote]);

  // Create new version (duplicate with version tracking)
  const handleCreateNewVersion = useCallback(async () => {
    if (!quote) return;

    try {
      const newQuote = await duplicateQuote(quote.id);
      if (newQuote) {
        toast.success(`Version ${newQuote.version} created!`);
        router.push(`/quote/${newQuote.id}`);
      }
    } catch (error) {
      console.error("Failed to create new version:", error);
      toast.error("Failed to create new version");
    }
  }, [quote, router]);

  // Edit original (unlock and edit in place)
  const handleEditOriginal = useCallback(async () => {
    if (!quote) return;

    try {
      await unlockQuoteForEditing(quote.id);
      setQuote({ ...quote, status: "draft" });
      setIsEditing(true);
      toast.info("Quote unlocked for editing");
    } catch (error) {
      console.error("Failed to unlock quote:", error);
      toast.error("Failed to unlock quote");
    }
  }, [quote]);

  if (isLoading) {
    return (
      <MobileShell>
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </MobileShell>
    );
  }

  if (!quote) {
    return (
      <MobileShell>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <p className="text-text-muted">Quote not found</p>
          <Link href="/">
            <Button variant="outline">Go Home</Button>
          </Link>
        </div>
      </MobileShell>
    );
  }

  const footer = (
    <div className="flex flex-col gap-3">
      {isEditing ? (
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditing(false)}
            className="flex-1"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              const form = document.querySelector("form");
              form?.requestSubmit();
            }}
            className="flex-1 bg-primary hover:bg-primary-dark"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <QuotePDF quote={quote} />
            <QuoteShare quote={quote} />
          </div>
          {quote.status === "draft" && (
            <Button
              onClick={handleSend}
              className="w-full bg-secondary hover:bg-secondary/90"
            >
              Mark as Sent
            </Button>
          )}
        </>
      )}
    </div>
  );

  return (
    <MobileShell footer={footer}>
      <div className="flex flex-col gap-4">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="text-text-muted hover:text-text">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex gap-2">
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditClick}
              >
                {quote.status !== "draft" ? (
                  <svg className="w-4 h-4 mr-1 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                )}
                Edit
              </Button>
            )}
            {/* Version Badge */}
            {quote.version && quote.version > 1 && (
              <span className="text-xs text-text-muted bg-gray-100 px-2 py-1 rounded">
                V{quote.version}
              </span>
            )}
            {/* Delete - Only show for drafts */}
            {quote.status === "draft" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            )}
          </div>
        </div>

        {/* Auth Modal */}
        <AuthModal
          open={showAuthModal}
          onOpenChange={setShowAuthModal}
          onSignUp={signUp}
          onSignIn={signIn}
          onSignInGoogle={signInGoogle}
        />

        {/* Edit Sent Quote Dialog */}
        <EditSentQuoteDialog
          open={showEditSentDialog}
          onOpenChange={setShowEditSentDialog}
          currentVersion={quote.version || 1}
          onCreateNewVersion={handleCreateNewVersion}
          onEditOriginal={handleEditOriginal}
        />

        {/* Content */}
        {isEditing ? (
          <QuoteForm
            quote={quote}
            onSave={handleSave}
            onShowAuthModal={() => setShowAuthModal(true)}
          />
        ) : (
          <QuotePreview quote={quote} />
        )}

        {/* Version History & Diff */}
        {!isEditing && versionHistory.length > 1 && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVersionDiff(!showVersionDiff)}
              className="w-full gap-2 text-text-muted"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              {showVersionDiff ? "Hide" : "Show"} Version Changes ({versionHistory.length} versions)
            </Button>

            {showVersionDiff && (
              <div className="mt-3 space-y-4">
                {versionHistory.slice(0, -1).map((version, idx) => {
                  const olderVersion = versionHistory[idx + 1];
                  return (
                    <QuoteVersionDiff
                      key={version.id}
                      older={olderVersion}
                      newer={version}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
