"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RecordingStatus } from "./RecordingStatus";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { addPendingAudio } from "@/lib/storage/pending";
import { saveQuote, generateSlug } from "@/lib/storage/quotes";
import { calculateQuoteTotals } from "@/lib/utils/gst";
import type { Quote, ExtractionResult } from "@/types/quote";

interface VoiceRecorderProps {
  onQuoteCreated?: (quote: Quote) => void;
}

export function VoiceRecorder({ onQuoteCreated }: VoiceRecorderProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");

  const {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    error: recordingError,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  } = useAudioRecorder();

  const processAudio = useCallback(
    async (blob: Blob) => {
      const audioId = uuidv4();

      try {
        setIsProcessing(true);
        setProcessingStatus("Saving locally...");

        // Save to pending immediately
        await addPendingAudio({
          id: audioId,
          blob,
          createdAt: new Date().toISOString(),
          retryCount: 0,
        });

        toast.success("Draft saved locally");

        setProcessingStatus("Transcribing audio...");

        // Try to transcribe
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");

        const transcribeRes = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!transcribeRes.ok) {
          throw new Error("Transcription failed");
        }

        const { text } = await transcribeRes.json();

        if (!text || text.trim().length === 0) {
          throw new Error("No speech detected");
        }

        setProcessingStatus("Extracting quote details...");

        // Extract quote data
        const extractRes = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!extractRes.ok) {
          throw new Error("Extraction failed");
        }

        const extraction: ExtractionResult = await extractRes.json();

        // Create quote object
        const quoteId = uuidv4();
        const slug = await generateSlug();

        const items = extraction.items.map((item) => ({
          id: uuidv4(),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
        }));

        const { subtotal, gst, total } = calculateQuoteTotals(items, false);

        const quote: Quote = {
          id: quoteId,
          customerName: extraction.customerName || "Customer",
          customerPhone: extraction.customerPhone ?? undefined,
          customerEmail: extraction.customerEmail ?? undefined,
          customerAddress: extraction.customerAddress ?? undefined,
          items,
          notes: extraction.notes ?? undefined,
          gstInclusive: false,
          subtotal,
          gst,
          total,
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          slug,
        };

        await saveQuote(quote);

        // Remove from pending since it succeeded
        const { removePendingAudio } = await import("@/lib/storage/pending");
        await removePendingAudio(audioId);

        setIsProcessing(false);
        setProcessingStatus("");
        resetRecording();

        if (extraction.confidence < 0.6) {
          toast.warning("Some details may need review", {
            description: "Please verify the extracted information",
          });
        } else {
          toast.success("Quote created!");
        }

        onQuoteCreated?.(quote);
        router.push(`/quote/${quoteId}`);
      } catch (err) {
        console.error("Processing error:", err);
        setIsProcessing(false);
        setProcessingStatus("");

        if (err instanceof Error && err.message === "No speech detected") {
          toast.error("No speech detected", {
            description: "Please try recording again",
          });
          resetRecording();
        } else {
          toast.info("Saved offline", {
            description: "Quote will sync when connected",
          });
          resetRecording();
        }
      }
    },
    [router, resetRecording, onQuoteCreated]
  );

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleConfirm = useCallback(async () => {
    if (audioBlob) {
      await processAudio(audioBlob);
    }
  }, [audioBlob, processAudio]);

  const handleCancel = useCallback(() => {
    resetRecording();
  }, [resetRecording]);

  // Show error
  if (recordingError) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-red-600 text-center font-medium">{recordingError}</p>
        <Button onClick={resetRecording} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  // Show processing state
  if (isProcessing) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
        <p className="text-text-muted text-center">{processingStatus}</p>
      </div>
    );
  }

  // Show confirmation after recording
  if (audioBlob && !isRecording) {
    return (
      <div className="flex flex-col items-center gap-6 p-6">
        <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center">
          <svg className="w-10 h-10 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-text text-center font-medium">Recording complete!</p>
        <p className="text-text-muted text-sm text-center">
          Ready to create your quote?
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleCancel} className="min-w-[100px]">
            Discard
          </Button>
          <Button onClick={handleConfirm} className="min-w-[100px] bg-primary hover:bg-primary-dark">
            Create Quote
          </Button>
        </div>
      </div>
    );
  }

  // Main recording UI
  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <RecordingStatus isRecording={isRecording} isPaused={isPaused} duration={duration} />

      <button
        onClick={handleRecordToggle}
        className={`
          w-24 h-24 rounded-full flex items-center justify-center
          transition-all duration-200 touch-target
          ${isRecording
            ? "bg-red-500 hover:bg-red-600 scale-110 shadow-lg shadow-red-500/30"
            : "bg-primary hover:bg-primary-dark shadow-lg shadow-primary/30"
          }
        `}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        {isRecording ? (
          <div className="w-8 h-8 bg-white rounded-sm" />
        ) : (
          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>

      <p className="text-text-muted text-sm text-center">
        {isRecording
          ? "Tap to stop recording"
          : "Tap to start recording your quote"
        }
      </p>

      {isRecording && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={isPaused ? resumeRecording : pauseRecording}
            className="min-w-[80px]"
          >
            {isPaused ? "Resume" : "Pause"}
          </Button>
        </div>
      )}
    </div>
  );
}
