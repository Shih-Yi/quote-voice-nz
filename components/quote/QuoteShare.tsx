"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Quote } from "@/types/quote";

interface QuoteShareProps {
  quote: Quote;
}

export function QuoteShare({ quote }: QuoteShareProps) {
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

  return (
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
  );
}
