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
import { RegisterPrompt } from "@/components/auth/RegisterPrompt";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { getQuoteById, saveQuote, deleteQuote } from "@/lib/storage/quotes";
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
  const { user, signUp, signIn, signInGoogle } = useAuth();

  useEffect(() => {
    async function loadQuote() {
      try {
        const data = await getQuoteById(resolvedParams.id);
        if (data) {
          setQuote(data);
          // Auto-edit mode for drafts
          if (data.status === "draft") {
            setIsEditing(true);
          }
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

  const handleSave = useCallback(async (updatedQuote: Quote) => {
    setIsSaving(true);
    try {
      await saveQuote(updatedQuote);
      setQuote(updatedQuote);
      setIsEditing(false);
      toast.success("Quote saved!");
    } catch (error) {
      console.error("Failed to save quote:", error);
      toast.error("Failed to save quote");
    } finally {
      setIsSaving(false);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!quote) return;

    const updatedQuote: Quote = {
      ...quote,
      status: "sent",
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveQuote(updatedQuote);
      setQuote(updatedQuote);
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
          <Link href="/" className="text-text-muted hover:text-text">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex gap-2">
            {!isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Button>
            )}
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
          </div>
        </div>

        {/* Registration Prompt - Show only for non-logged-in users */}
        {!user && (
          <RegisterPrompt onRegisterClick={() => setShowAuthModal(true)} />
        )}

        {/* Auth Modal */}
        <AuthModal
          open={showAuthModal}
          onOpenChange={setShowAuthModal}
          onSignUp={signUp}
          onSignIn={signIn}
          onSignInGoogle={signInGoogle}
        />

        {/* Content */}
        {isEditing ? (
          <QuoteForm quote={quote} onSave={handleSave} />
        ) : (
          <QuotePreview quote={quote} />
        )}
      </div>
    </MobileShell>
  );
}
