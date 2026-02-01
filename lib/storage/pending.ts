import { get, set, del } from "idb-keyval";
import type { PendingAudio } from "@/types/quote";

const PENDING_KEY = "ksq_pending_audio";

export async function getPendingAudio(): Promise<PendingAudio[]> {
  const pending = await get<PendingAudio[]>(PENDING_KEY);
  return pending || [];
}

export async function addPendingAudio(audio: PendingAudio): Promise<void> {
  const pending = await getPendingAudio();
  pending.push(audio);
  await set(PENDING_KEY, pending);
}

export async function removePendingAudio(id: string): Promise<void> {
  const pending = await getPendingAudio();
  const filtered = pending.filter((p) => p.id !== id);
  await set(PENDING_KEY, filtered);
}

export async function updatePendingAudioRetry(id: string): Promise<void> {
  const pending = await getPendingAudio();
  const item = pending.find((p) => p.id === id);
  if (item) {
    item.retryCount += 1;
    await set(PENDING_KEY, pending);
  }
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
