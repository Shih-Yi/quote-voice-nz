import { get, set, del } from "idb-keyval";
import type { PendingAudio } from "@/types/quote";

const PENDING_KEY = "ksq_pending_audio";

// Leave 1MB headroom under the server's 25MB Whisper cap so a blob that fits
// here is guaranteed to upload. At 128kbps × 2-minute recording cap, real
// blobs are ~2MB; this only fires for pathological codec/VBR cases.
export const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

export class PendingAudioTooLargeError extends Error {
  constructor(public readonly size: number) {
    super(
      `Audio file too large (${(size / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_AUDIO_BYTES / 1024 / 1024}MB.`
    );
    this.name = "PendingAudioTooLargeError";
  }
}

export class PendingAudioQuotaExceededError extends Error {
  constructor() {
    super("Device storage is full. Sync existing recordings before adding more.");
    this.name = "PendingAudioQuotaExceededError";
  }
}

export async function getPendingAudio(): Promise<PendingAudio[]> {
  const pending = await get<PendingAudio[]>(PENDING_KEY);
  return pending || [];
}

export async function addPendingAudio(audio: PendingAudio): Promise<void> {
  if (audio.blob.size > MAX_AUDIO_BYTES) {
    throw new PendingAudioTooLargeError(audio.blob.size);
  }

  const pending = await getPendingAudio();
  try {
    await set(PENDING_KEY, [...pending, audio]);
  } catch (err) {
    // IndexedDB throws DOMException("QuotaExceededError") when the browser's
    // per-origin quota is hit (mobile Safari ≈ 50MB).
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      throw new PendingAudioQuotaExceededError();
    }
    throw err;
  }
}

export async function removePendingAudio(id: string): Promise<void> {
  const pending = await getPendingAudio();
  const filtered = pending.filter((p) => p.id !== id);
  await set(PENDING_KEY, filtered);
}

export async function updatePendingAudioRetry(id: string): Promise<void> {
  const pending = await getPendingAudio();
  const updated = pending.map((p) =>
    p.id === id ? { ...p, retryCount: p.retryCount + 1 } : p
  );
  await set(PENDING_KEY, updated);
}

// Swap the stored blob for a smaller/compressed version of the same recording.
// The queued copy is written before compression runs (so nothing is lost if
// compression throws), which means retries would otherwise re-upload the raw
// recording — roughly 10x the bytes over a rural mobile connection.
export async function replacePendingAudioBlob(
  id: string,
  blob: Blob
): Promise<void> {
  if (blob.size > MAX_AUDIO_BYTES) return;

  const pending = await getPendingAudio();
  if (!pending.some((p) => p.id === id)) return;

  await set(
    PENDING_KEY,
    pending.map((p) => (p.id === id ? { ...p, blob } : p))
  );
}

// Filename extension Groq/Whisper should see for a stored recording. The
// server infers the audio format from the filename, so a compressed MP3 sent
// as "recording.webm" can be rejected or mis-decoded.
export function audioExtension(blob: Blob): string {
  if (blob.type.includes("mpeg") || blob.type.includes("mp3")) return "mp3";
  if (blob.type.includes("mp4")) return "mp4";
  return "webm";
}

export async function getPendingCount(): Promise<number> {
  const pending = await getPendingAudio();
  return pending.length;
}

export async function clearAllPending(): Promise<void> {
  await del(PENDING_KEY);
}

export async function getAudioBlob(id: string): Promise<Blob | undefined> {
  const pending = await getPendingAudio();
  const item = pending.find((p) => p.id === id);
  return item?.blob;
}

// Age thresholds for surfacing stale items in the UI. We never auto-delete —
// pending audio represents un-replayable user work, so the user must decide
// whether to download or discard.
export const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
export const ANCIENT_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

export interface StalePendingAudioState {
  staleCount: number; // age >= 7 days
  ancientCount: number; // age >= 30 days
  staleItems: PendingAudio[];
}

export async function getStalePendingAudio(): Promise<StalePendingAudioState> {
  const all = await getPendingAudio();
  const now = Date.now();

  const staleItems: PendingAudio[] = [];
  let ancientCount = 0;

  for (const item of all) {
    const age = now - new Date(item.createdAt).getTime();
    if (age >= STALE_THRESHOLD_MS) {
      staleItems.push(item);
      if (age >= ANCIENT_THRESHOLD_MS) ancientCount++;
    }
  }

  return {
    staleCount: staleItems.length,
    ancientCount,
    staleItems,
  };
}
