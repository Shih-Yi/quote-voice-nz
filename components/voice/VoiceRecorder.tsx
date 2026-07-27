"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RecordingStatus } from "./RecordingStatus";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import {
  addPendingAudio,
  audioExtension,
  removePendingAudio,
  replacePendingAudioBlob,
} from "@/lib/storage/pending";
import { saveQuote, generateSlug } from "@/lib/storage/quotes";
import { getDeviceToken } from "@/lib/storage/deviceToken";
import { emit, KSQ_EVENTS } from "@/lib/events";
import { calculateQuoteTotals } from "@/lib/utils/gst";
import { compressToMp3 } from "@/lib/utils/audioCompress";
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
      const createdAt = new Date().toISOString();
      // One id for both the queued recording and the quote it becomes. If this
      // run dies after the quote is saved but before the queue entry is
      // removed, a later replay (useOfflineStorage.syncSingle) upserts the same
      // quote id rather than creating a duplicate draft.
      const pendingId = uuidv4();
      let compressed: Blob | null = null;

      // Offline-first: persist the recording BEFORE any network call. When
      // the device is fully offline, fetch() rejects without ever producing
      // a response — persisting only on !res.ok would lose the audio.
      // Removed again once the quote is created (or the audio proves silent).
      let persisted = false;
      try {
        await addPendingAudio({ id: pendingId, blob, createdAt, retryCount: 0 });
        persisted = true;
      } catch (err) {
        if (err instanceof Error && err.name === "PendingAudioTooLargeError") {
          toast.error("Recording too large", {
            description: "Please record a shorter clip (max ~24MB)",
          });
          resetRecording();
          return;
        }
        // Storage quota full — keep going online-only; the pipeline may still
        // succeed, but a failure now means the recording can't be recovered.
        console.warn("Failed to persist recording locally:", err);
      }

      try {
        setIsProcessing(true);
        setProcessingStatus("Compressing audio...");

        // Compress to MP3 before upload (saves bandwidth on mobile)
        const mp3Blob = await compressToMp3(blob);
        compressed = mp3Blob;

        setProcessingStatus("Transcribing audio...");

        // Try to transcribe
        const formData = new FormData();
        formData.append("audio", mp3Blob, `recording.${audioExtension(mp3Blob)}`);

        const deviceToken = await getDeviceToken();
        const transcribeRes = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "x-device-token": deviceToken },
          body: formData,
        });

        if (!transcribeRes.ok) {
          const errBody = await transcribeRes.json().catch(() => ({}));

          // Anon daily quota hit — prompt for login; pending audio will replay
          // automatically after successful sign-in (see AuthGate).
          if (errBody?.action === "login_required") {
            emit(KSQ_EVENTS.AUTH_REQUIRED, { reason: "anon_quota_exceeded" });
            throw new Error("login_required");
          }

          throw new Error(errBody?.error || "Transcription failed");
        }

        const { text } = await transcribeRes.json();

        if (!text || text.trim().length === 0) {
          // Unrecoverable — no point retrying silent audio
          throw new Error("No speech detected");
        }

        setProcessingStatus("Extracting quote details...");

        // Extract quote data
        const extractRes = await fetch("/api/extract", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-device-token": deviceToken,
          },
          body: JSON.stringify({ text }),
        });

        if (!extractRes.ok) {
          const errBody = await extractRes.json().catch(() => ({}));
          if (errBody?.action === "login_required") {
            emit(KSQ_EVENTS.AUTH_REQUIRED, { reason: "anon_quota_exceeded" });
            throw new Error("login_required");
          }

          throw new Error(errBody?.error || "Extraction failed");
        }

        const extraction: ExtractionResult = await extractRes.json();

        // Create quote object
        const slug = await generateSlug();

        const items = extraction.items.map((item) => ({
          id: uuidv4(),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: Number((item.quantity * item.unitPrice).toFixed(2)),
        }));

        const { subtotal, gst, total } = calculateQuoteTotals(items, false);

        const quote: Quote = {
          id: pendingId,
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
          createdAt,
          updatedAt: new Date().toISOString(),
          slug,
        };

        await saveQuote(quote, { localOnly: true });

        // Quote created — the safety-net copy of the audio is no longer
        // needed. Failure here is non-fatal; the leftover pending item would
        // just re-create a duplicate draft on the next Sync All.
        if (persisted) {
          await removePendingAudio(pendingId).catch((err) => {
            console.warn("Failed to remove pending audio after success:", err);
          });
        }

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
        router.push(`/quote/${pendingId}`);
      } catch (err) {
        console.error("Processing error:", err);
        setIsProcessing(false);
        setProcessingStatus("");

        // The queued copy is the raw recording (persisted before compression
        // ran). Now that we know compression worked and the upload didn't,
        // swap in the smaller file so the retry doesn't re-send the original.
        if (persisted && compressed && compressed.size < blob.size) {
          await replacePendingAudioBlob(pendingId, compressed).catch(() => {});
        }

        if (err instanceof Error && err.message === "No speech detected") {
          // Unrecoverable — keeping silent audio queued would just fail again.
          if (persisted) {
            await removePendingAudio(pendingId).catch(() => {});
          }
          toast.error("No speech detected", {
            description: "Please try recording again",
          });
        } else if (err instanceof Error && err.message === "login_required") {
          toast.info("Free trial limit reached", {
            description: persisted
              ? "Sign in to continue — your recording is saved"
              : "Sign in to continue",
          });
        } else if (persisted) {
          toast.info("Saved offline", {
            description: "Quote will sync when connected",
          });
        } else {
          toast.error("Couldn't process recording", {
            description:
              "Device storage is full and the request failed — please sync existing recordings and try again",
          });
        }
        resetRecording();
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
