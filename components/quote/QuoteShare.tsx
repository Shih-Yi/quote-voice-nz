"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { getSyncQueue } from "@/lib/storage/quotes";
import { on, KSQ_EVENTS } from "@/lib/events";
import type { Quote } from "@/types/quote";

interface QuoteShareProps {
  quote: Quote;
}

export function QuoteShare({ quote }: QuoteShareProps) {
  const { isPaid, isLoading: subLoading } = useSubscription();
  const [isSending, setIsSending] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [emailTo, setEmailTo] = useState(quote.customerEmail || "");
  // null while unknown (first check in flight) — assume shareable so the
  // buttons don't flicker into a disabled state on every render.
  const [isPublished, setIsPublished] = useState<boolean | null>(null);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/q/${quote.slug}`
    : "";

  // A public /q/<slug> link only resolves once the cloud has this quote AND
  // has its current state (the public RPC filters to sent/accepted rows). A
  // quote saved or marked-sent while offline is queued for retry, so sharing
  // it now would send the customer to a "Quote Not Found" page.
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const queued = (await getSyncQueue()).includes(quote.id);
        if (!cancelled) {
          setIsPublished(Boolean(quote.cloudSyncedAt) && !queued);
        }
      } catch {
        // Can't tell — don't block sharing on a storage read failure.
        if (!cancelled) setIsPublished(true);
      }
    };

    check();
    // Background sync flushes the queue on reconnect; re-check when it does.
    const unsubscribe = on(KSQ_EVENTS.QUOTES_CHANGED, check);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [quote.id, quote.cloudSyncedAt]);

  const blockedOffline = isPublished === false;

  const handleShare = useCallback(async () => {
    const shareData = {
      title: `Quote for ${quote.customerName}`,
      text: `Quote from QuoteTalk - Total: $${quote.total.toFixed(2)} NZD`,
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard!");
      } catch {
        toast.error("Failed to copy link");
      }
    }
  }, [quote.customerName, quote.total, shareUrl]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  }, [shareUrl]);

  const handleSendEmail = useCallback(async () => {
    if (!emailTo.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    setIsSending(true);
    try {
      // Only the quote id and the destination go over the wire. The subject,
      // link, amount and sender name are all derived server-side from the
      // stored quote — the client cannot dictate what the email says.
      const res = await fetch("/api/send-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.id,
          to: emailTo.trim(),
        }),
      });

      if (res.ok) {
        toast.success("Quote sent via email!");
        setShowEmailInput(false);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to send email");
      }
    } catch {
      toast.error("Failed to send email");
    } finally {
      setIsSending(false);
    }
  }, [emailTo, quote.id]);

  return (
    <div className="flex flex-col gap-2">
      {/* Free-tier limitation, stated on the owner's side before they send.
          The customer never sees a paywall — their copy of the quote simply
          has no Accept button, and shows the contact details instead. */}
      {!subLoading && !isPaid && (
        <div className="flex gap-2 rounded-md border border-border bg-bg p-3 text-xs text-text-muted">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            On the free plan your customer can view this quote but can&apos;t
            accept it online — they&apos;ll need to ring or text you back.{" "}
            <a href="/pricing" className="text-primary underline font-medium hover:text-primary-dark">
              Upgrade to Pro
            </a>{" "}
            to let them accept with one tap.
          </span>
        </div>
      )}

      {blockedOffline && (
        <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>
            Not uploaded yet — the link won&apos;t open for your customer until this
            quote syncs. It&apos;ll upload automatically once you&apos;re back online.
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleCopyLink}
          disabled={blockedOffline}
          className="gap-2 flex-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy Link
        </Button>
        <Button
          onClick={handleShare}
          disabled={blockedOffline}
          className="gap-2 flex-1 bg-primary hover:bg-primary-dark"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share
        </Button>
      </div>

      {/* Email Send */}
      {!showEmailInput ? (
        <Button
          variant="outline"
          onClick={() => setShowEmailInput(true)}
          disabled={blockedOffline}
          className="w-full gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Send via Email
        </Button>
      ) : (
        <div className="flex gap-2">
          <Input
            type="email"
            inputMode="email"
            placeholder="customer@example.com"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendEmail()}
            className="flex-1"
            autoFocus
          />
          <Button
            onClick={handleSendEmail}
            disabled={isSending}
            className="bg-primary hover:bg-primary-dark min-w-[80px]"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Send"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
