import { describe, it, expect } from "vitest";
import {
  generateRandomSlug,
  generateDeviceToken,
  isValidSlug,
  randomString,
  SLUG_LENGTH,
} from "../randomId";

describe("randomId", () => {
  describe("generateRandomSlug", () => {
    // The slug is the only gate on the public /q/[slug] page. 8 base36
    // characters ≈ 2^41; at 100k quotes a hit takes ~2.8e7 guesses.
    it("is 16 characters of lowercase base36", () => {
      const slug = generateRandomSlug();
      expect(slug).toHaveLength(SLUG_LENGTH);
      expect(slug).toMatch(/^[a-z0-9]{16}$/);
    });

    it("does not repeat across many draws", () => {
      const slugs = new Set(Array.from({ length: 5000 }, generateRandomSlug));
      expect(slugs.size).toBe(5000);
    });

    // Math.random() was the old source. A CSPRNG will not produce a run of
    // draws that a seeded generator would — this is a smoke test that we are
    // getting real entropy, not a constant or a stuck value.
    it("varies in every position", () => {
      const draws = Array.from({ length: 500 }, generateRandomSlug);
      for (let i = 0; i < SLUG_LENGTH; i++) {
        const chars = new Set(draws.map((s) => s[i]));
        expect(chars.size).toBeGreaterThan(10);
      }
    });
  });

  describe("randomString", () => {
    it("produces the requested length for awkward sizes", () => {
      for (const n of [1, 7, 33, 64]) {
        expect(randomString(n)).toHaveLength(n);
      }
    });

    // 256 % 36 = 4, so a naive `byte % 36` would favour the first four
    // characters of the alphabet by ~1.6%. Rejection sampling removes that.
    it("distributes characters without modulo bias", () => {
      const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
      const sample = randomString(72_000, alphabet);
      const counts = new Map<string, number>();
      for (const ch of sample) counts.set(ch, (counts.get(ch) ?? 0) + 1);

      const expected = sample.length / alphabet.length;
      for (const ch of alphabet) {
        const seen = counts.get(ch) ?? 0;
        // Generous band — this catches systematic bias, not noise.
        expect(seen).toBeGreaterThan(expected * 0.85);
        expect(seen).toBeLessThan(expected * 1.15);
      }
    });
  });

  describe("generateDeviceToken", () => {
    // Sole ownership credential for anonymous quotes. Format is unchanged so
    // tokens already on devices keep working.
    it("keeps the dt_ prefix and 32-character body", () => {
      expect(generateDeviceToken()).toMatch(/^dt_[a-z0-9]{32}$/);
    });

    it("does not repeat", () => {
      const tokens = new Set(Array.from({ length: 2000 }, generateDeviceToken));
      expect(tokens.size).toBe(2000);
    });
  });

  describe("isValidSlug", () => {
    it.each(["abc12345", "a1b2c3d4e5f6g7h8", "aaaaaa", "a".repeat(32)])(
      "accepts %s",
      (slug) => expect(isValidSlug(slug)).toBe(true)
    );

    it.each([
      ["too short", "abc"],
      ["too long", "a".repeat(33)],
      ["uppercase", "ABC12345"],
      ["a slash", "abc/12345"],
      ["path traversal", "../../etc"],
      ["a space", "abc 1234"],
      ["empty", ""],
    ])("rejects %s", (_label, slug) => expect(isValidSlug(slug)).toBe(false));

    it.each([[null], [undefined], [12345678], [{}], [["abc12345"]]])(
      "rejects the non-string %s",
      (value) => expect(isValidSlug(value)).toBe(false)
    );
  });
});
