import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PendingAudio } from "@/types/quote";

const mockStore = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: vi.fn((key: string) => Promise.resolve(mockStore.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
  del: vi.fn((key: string) => {
    mockStore.delete(key);
    return Promise.resolve();
  }),
}));

import {
  getPendingAudio,
  addPendingAudio,
  removePendingAudio,
  updatePendingAudioRetry,
  getPendingCount,
  clearAllPending,
  getAudioBlob,
  replacePendingAudioBlob,
  audioExtension,
} from "../pending";

function makePendingAudio(id: string): PendingAudio {
  return {
    id,
    blob: new Blob(["audio data"], { type: "audio/webm" }),
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
}

describe("pending audio storage", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  describe("getPendingAudio", () => {
    it("returns empty array when no pending audio", async () => {
      expect(await getPendingAudio()).toEqual([]);
    });

    it("returns stored pending audio", async () => {
      const item = makePendingAudio("p1");
      mockStore.set("ksq_pending_audio", [item]);
      const result = await getPendingAudio();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("p1");
    });
  });

  describe("addPendingAudio", () => {
    it("adds new pending audio", async () => {
      const item = makePendingAudio("p1");
      await addPendingAudio(item);
      const result = await getPendingAudio();
      expect(result).toHaveLength(1);
    });

    it("appends to existing pending audio", async () => {
      await addPendingAudio(makePendingAudio("p1"));
      await addPendingAudio(makePendingAudio("p2"));
      const result = await getPendingAudio();
      expect(result).toHaveLength(2);
    });
  });

  describe("removePendingAudio", () => {
    it("removes specific pending audio by id", async () => {
      await addPendingAudio(makePendingAudio("p1"));
      await addPendingAudio(makePendingAudio("p2"));
      await removePendingAudio("p1");
      const result = await getPendingAudio();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("p2");
    });

    it("does nothing when id not found", async () => {
      await addPendingAudio(makePendingAudio("p1"));
      await removePendingAudio("nonexistent");
      const result = await getPendingAudio();
      expect(result).toHaveLength(1);
    });
  });

  describe("updatePendingAudioRetry", () => {
    it("increments retry count", async () => {
      await addPendingAudio(makePendingAudio("p1"));
      await updatePendingAudioRetry("p1");
      const result = await getPendingAudio();
      expect(result[0].retryCount).toBe(1);
    });

    it("does nothing for non-existent item", async () => {
      await addPendingAudio(makePendingAudio("p1"));
      await updatePendingAudioRetry("nonexistent");
      const result = await getPendingAudio();
      expect(result[0].retryCount).toBe(0);
    });
  });

  describe("getPendingCount", () => {
    it("returns 0 for empty storage", async () => {
      expect(await getPendingCount()).toBe(0);
    });

    it("returns correct count", async () => {
      await addPendingAudio(makePendingAudio("p1"));
      await addPendingAudio(makePendingAudio("p2"));
      expect(await getPendingCount()).toBe(2);
    });
  });

  describe("clearAllPending", () => {
    it("removes all pending audio", async () => {
      await addPendingAudio(makePendingAudio("p1"));
      await addPendingAudio(makePendingAudio("p2"));
      await clearAllPending();
      expect(await getPendingCount()).toBe(0);
    });
  });

  describe("getAudioBlob", () => {
    it("returns blob for existing item", async () => {
      await addPendingAudio(makePendingAudio("p1"));
      const blob = await getAudioBlob("p1");
      expect(blob).toBeInstanceOf(Blob);
    });

    it("returns undefined for non-existent item", async () => {
      expect(await getAudioBlob("nonexistent")).toBeUndefined();
    });
  });

  describe("replacePendingAudioBlob", () => {
    it("swaps in the compressed blob so retries upload fewer bytes", async () => {
      await addPendingAudio(makePendingAudio("p1"));
      const mp3 = new Blob(["mp3"], { type: "audio/mpeg" });

      await replacePendingAudioBlob("p1", mp3);

      const stored = await getPendingAudio();
      expect(stored[0].blob.type).toBe("audio/mpeg");
      // Everything else about the queue entry is untouched.
      expect(stored[0].id).toBe("p1");
      expect(stored[0].retryCount).toBe(0);
    });

    it("is a no-op for an unknown id", async () => {
      await addPendingAudio(makePendingAudio("p1"));

      await replacePendingAudioBlob("nope", new Blob(["x"], { type: "audio/mpeg" }));

      const stored = await getPendingAudio();
      expect(stored).toHaveLength(1);
      expect(stored[0].blob.type).toBe("audio/webm");
    });
  });

  describe("audioExtension", () => {
    it("maps blob types to the extension Whisper expects", () => {
      expect(audioExtension(new Blob([], { type: "audio/mpeg" }))).toBe("mp3");
      expect(audioExtension(new Blob([], { type: "audio/mp4" }))).toBe("mp4");
      expect(audioExtension(new Blob([], { type: "audio/webm" }))).toBe("webm");
    });

    it("falls back to webm for an unknown type", () => {
      expect(audioExtension(new Blob([], { type: "" }))).toBe("webm");
    });
  });
});
