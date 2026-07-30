import { describe, it, expect, vi, beforeEach } from "vitest";

// --- In-memory mock for idb-keyval ---
const mockStore = new Map<string, unknown>();
let getShouldThrow = false;
let setShouldThrow = false;

vi.mock("idb-keyval", () => ({
  get: vi.fn((key: string) => {
    if (getShouldThrow) return Promise.reject(new Error("storage unavailable"));
    return Promise.resolve(mockStore.get(key));
  }),
  set: vi.fn((key: string, value: unknown) => {
    if (setShouldThrow) return Promise.reject(new Error("quota exceeded"));
    mockStore.set(key, value);
    return Promise.resolve();
  }),
}));

import {
  getDefaultGstInclusive,
  setDefaultGstInclusive,
  __testing,
} from "../preferences";

describe("GST default preference", () => {
  beforeEach(() => {
    mockStore.clear();
    getShouldThrow = false;
    setShouldThrow = false;
  });

  // NZ tradies quoting homeowners quote GST-inclusive. The voice flow used to
  // hardcode exclusive, which is the B2B convention.
  it("starts GST-inclusive for a tradie who has never chosen", async () => {
    expect(await getDefaultGstInclusive()).toBe(true);
    expect(__testing.DEFAULT_GST_INCLUSIVE).toBe(true);
  });

  it("remembers an explicit switch to exclusive", async () => {
    await setDefaultGstInclusive(false);
    expect(await getDefaultGstInclusive()).toBe(false);
  });

  it("remembers a switch back to inclusive", async () => {
    await setDefaultGstInclusive(false);
    await setDefaultGstInclusive(true);
    expect(await getDefaultGstInclusive()).toBe(true);
  });

  it("ignores a non-boolean left in storage", async () => {
    mockStore.set(__testing.GST_INCLUSIVE_KEY, "yes");
    expect(await getDefaultGstInclusive()).toBe(true);
  });

  // The voice flow reads this on every recording — it must never be the thing
  // that stops a quote being created.
  it("falls back to the default when storage cannot be read", async () => {
    getShouldThrow = true;
    await expect(getDefaultGstInclusive()).resolves.toBe(true);
  });

  it("does not throw when the preference cannot be written", async () => {
    setShouldThrow = true;
    await expect(setDefaultGstInclusive(false)).resolves.toBeUndefined();
  });
});
