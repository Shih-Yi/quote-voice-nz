import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock idb-keyval before importing module
const mockStore = new Map<string, unknown>();

vi.mock("idb-keyval", () => ({
  get: vi.fn((key: string) => Promise.resolve(mockStore.get(key))),
  set: vi.fn((key: string, value: unknown) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
}));

import { getDeviceToken, hasDeviceToken } from "../deviceToken";

describe("deviceToken", () => {
  beforeEach(() => {
    mockStore.clear();
  });

  describe("getDeviceToken", () => {
    it("generates a new token when none exists", async () => {
      const token = await getDeviceToken();
      expect(token).toBeTruthy();
      expect(token.startsWith("dt_")).toBe(true);
      expect(token.length).toBe(35); // "dt_" + 32 chars
    });

    it("returns existing token on subsequent calls", async () => {
      const token1 = await getDeviceToken();
      const token2 = await getDeviceToken();
      expect(token1).toBe(token2);
    });

    it("persists token to storage", async () => {
      await getDeviceToken();
      expect(mockStore.has("ksq_device_token")).toBe(true);
    });
  });

  describe("hasDeviceToken", () => {
    it("returns false when no token exists", async () => {
      expect(await hasDeviceToken()).toBe(false);
    });

    it("returns true after token is created", async () => {
      await getDeviceToken();
      expect(await hasDeviceToken()).toBe(true);
    });
  });
});
