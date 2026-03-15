"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatNZD } from "@/lib/utils/currency";
import type { Quote } from "@/types/quote";

interface QuoteShareProps {
  quote: Quote;
}

export function QuoteShare({ quote }: QuoteShareProps) {
  const [isSending, setIsSending] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [emailTo, setEmailTo] = useState(quote.customerEmail || "");

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/q/${quote.slug}`
    : "";

  const handleShare = useCallback(async () => {
    const shareData = {
      title: `Quote for ${quote.customerName}`,
      text: `Quote from KiwiSpeakQuote - Total: $${quote.total.toFixed(2)} NZD`,
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
      const res = await fetch("/api/send-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim(),
          customerName: quote.customerName,
          quoteUrl: shareUrl,
          total: formatNZD(quote.total),
          providerName: quote.providerDetails?.businessName || quote.ownerProfile?.businessName,
        }),
      });

      if (res.ok) {
        toast.success("Quote sent via email!");
        setShowEmailInput(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send email");
      }
    } catch {
      toast.error("Failed to send email");
    } finally {
      setIsSending(false);
    }
  }, [emailTo, quote, shareUrl]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleCopyLink} className="gap-2 flex-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy Link
        </Button>
        <Button onClick={handleShare} className="gap-2 flex-1 bg-primary hover:bg-primary-dark">
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
