"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const MAX_DURATION_MS = 120000; // 2 minutes

interface UseAudioRecorderResult {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(50);
    }
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current + pausedDurationRef.current;
      setDuration(Math.floor(elapsed / 1000));

      if (elapsed >= MAX_DURATION_MS) {
        stopRecording();
      }
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setAudioBlob(null);
      chunksRef.current = [];
      pausedDurationRef.current = 0;

      // Check if mediaDevices is available (requires HTTPS or localhost)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Recording requires HTTPS. Please use localhost or a secure connection.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          // Remove fixed sampleRate to avoid OverconstrainedError on some mobile devices
        },
      });

      // Determine the best supported MIME type
      // iOS Safari prefers audio/mp4 or audio/aac
      // Chrome/Firefox prefer audio/webm
      const getMimeType = () => {
        const types = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "audio/aac",
        ];
        for (const type of types) {
          if (MediaRecorder.isTypeSupported(type)) {
            return type;
          }
        }
        return undefined; // Let browser choose default
      };

      const mimeType = getMimeType();
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 128000,
      };
      
      if (mimeType) {
        options.mimeType = mimeType;
      }

      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Use the actual mimeType the recorder settled on, or the one we requested
        const finalType = mediaRecorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalType });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setError("Recording failed. Please try again.");
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);
      startTimer();
      triggerHaptic();
    } catch (err) {
      console.error("Recording error:", err);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError("Microphone access denied. Please allow microphone access.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setError("No microphone found. Please connect a microphone.");
        } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
           setError("Microphone is busy or not readable. Close other apps using mic.");
        } else if (err.name === "OverconstrainedError") {
           setError("Microphone settings not supported by this device.");
        } else {
          setError(`Failed to start recording (${err.name}).`);
        }
      } else {
        setError("Failed to start recording.");
      }
    }
  }, [startTimer, triggerHaptic]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      stopTimer();
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      triggerHaptic();
    }
  }, [isRecording, stopTimer, triggerHaptic]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      pausedDurationRef.current += Date.now() - startTimeRef.current;
      stopTimer();
      setIsPaused(true);
      triggerHaptic();
    }
  }, [isRecording, isPaused, stopTimer, triggerHaptic]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      startTimeRef.current = Date.now();
      startTimer();
      setIsPaused(false);
      triggerHaptic();
    }
  }, [isRecording, isPaused, startTimer, triggerHaptic]);

  const resetRecording = useCallback(() => {
    stopTimer();
    if (mediaRecorderRef.current) {
      if (isRecording) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
      mediaRecorderRef.current = null;
    }
    chunksRef.current = [];
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
    setAudioBlob(null);
    setError(null);
    pausedDurationRef.current = 0;
  }, [isRecording, stopTimer]);

  useEffect(() => {
    return () => {
      stopTimer();
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stopTimer]);

  return {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  };
}
