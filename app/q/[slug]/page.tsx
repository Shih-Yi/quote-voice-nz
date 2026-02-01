"use client";

import { useEffect, useState, use } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { QuoteItem } from "@/components/quote/QuoteItem";
import { QuotePDF } from "@/components/quote/QuotePDF";
import { RegisterPrompt } from "@/components/auth/RegisterPrompt";
import { AuthModal } from "@/components/auth/AuthModal";
import { getQuoteBySlug } from "@/lib/storage/quotes";
import { formatNZD } from "@/lib/utils/currency";
import { formatNZDate } from "@/lib/utils/date";
import { useAuth } from "@/hooks/useAuth";
import type { Quote } from "@/types/quote";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function PublicQuotePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, signUp, signIn, signInGoogle } = useAuth();

  useEffect(() => {
    async function loadQuote() {
      try {
        const data = await getQuoteBySlug(resolvedParams.slug);
        setQuote(data || null);
      } catch (error) {
        console.error("Failed to load quote:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadQuote();
  }, [resolvedParams.slug]);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-text mb-2">Quote Not Found</h1>
            <p className="text-text-muted">
              This quote may have been deleted or the link is incorrect.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">KQ</span>
            </div>
            <div>
              <h1 className="font-semibold text-text">KiwiSpeakQuote</h1>
              <p className="text-sm text-text-muted">Quote</p>
            </div>
          </div>
          <QuotePDF quote={quote} />
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

        {/* Quote Content */}
        <div id="quote-preview" className="space-y-4">
          {/* Date & Status */}
          <div className="flex items-center justify-between">
            <p className="text-text-muted text-sm">
              {formatNZDate(quote.createdAt)}
            </p>
            {quote.status === "sent" && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                Sent
              </span>
            )}
          </div>

          {/* Customer Details */}
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm font-medium text-text-muted">Quote For</p>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold text-text">{quote.customerName}</p>
              {quote.customerAddress && (
                <p className="text-text-muted mt-1 whitespace-pre-line">
                  {quote.customerAddress}
                </p>
              )}
              {quote.customerPhone && (
                <p className="text-text-muted mt-2">
                  <a href={`tel:${quote.customerPhone}`} className="hover:text-primary">
                    {quote.customerPhone}
                  </a>
                </p>
              )}
              {quote.customerEmail && (
                <p className="text-text-muted">
                  <a href={`mailto:${quote.customerEmail}`} className="hover:text-primary">
                    {quote.customerEmail}
                  </a>
                </p>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="pb-2">
              <p className="text-sm font-medium text-text-muted">Items</p>
            </CardHeader>
            <CardContent>
              {quote.items.map((item) => (
                <QuoteItem key={item.id} item={item} />
              ))}
            </CardContent>
          </Card>

          {/* Notes */}
          {quote.notes && (
            <Card>
              <CardHeader className="pb-2">
                <p className="text-sm font-medium text-text-muted">Notes</p>
              </CardHeader>
              <CardContent>
                <p className="text-text whitespace-pre-line">{quote.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Totals */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex justify-between text-text-muted">
                  <span>Subtotal</span>
                  <span>{formatNZD(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>GST (15%){quote.gstInclusive ? " incl." : ""}</span>
                  <span>{formatNZD(quote.gst)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-2xl font-bold text-text">
                  <span>Total</span>
                  <span>{formatNZD(quote.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-text-muted">
          <p>Generated with KiwiSpeakQuote</p>
          <p className="mt-1">
            <a href="/" className="text-primary hover:text-primary-dark">
              Create your own quotes
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
