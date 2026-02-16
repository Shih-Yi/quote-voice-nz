import { describe, it, expect } from "vitest";
import { formatNZD, parseNZD, roundToTwoDecimals } from "../currency";

describe("currency utilities", () => {
  describe("formatNZD", () => {
    it("formats positive amounts", () => {
      const result = formatNZD(100);
      expect(result).toContain("100.00");
      expect(result).toContain("$");
    });

    it("formats zero", () => {
      const result = formatNZD(0);
      expect(result).toContain("0.00");
    });

    it("formats decimal amounts with two places", () => {
      const result = formatNZD(99.9);
      expect(result).toContain("99.90");
    });

    it("formats large amounts with grouping", () => {
      const result = formatNZD(1234567.89);
      expect(result).toContain("1,234,567.89");
    });

    it("formats negative amounts", () => {
      const result = formatNZD(-50);
      expect(result).toContain("50.00");
    });
  });

  describe("parseNZD", () => {
    it("parses clean numeric strings", () => {
      expect(parseNZD("100")).toBe(100);
      expect(parseNZD("99.95")).toBe(99.95);
    });

    it("strips currency symbols", () => {
      expect(parseNZD("$100.00")).toBe(100);
      expect(parseNZD("NZD 250.50")).toBe(250.5);
    });

    it("strips commas", () => {
      expect(parseNZD("1,234.56")).toBe(1234.56);
    });

    it("returns 0 for invalid input", () => {
      expect(parseNZD("")).toBe(0);
      expect(parseNZD("abc")).toBe(0);
      expect(parseNZD("no numbers here")).toBe(0);
    });

    it("handles negative values", () => {
      expect(parseNZD("-50.00")).toBe(-50);
    });
  });

  describe("roundToTwoDecimals", () => {
    it("rounds down", () => {
      expect(roundToTwoDecimals(1.234)).toBe(1.23);
    });

    it("rounds up", () => {
      expect(roundToTwoDecimals(1.235)).toBe(1.24);
    });

    it("leaves exact two-decimal values unchanged", () => {
      expect(roundToTwoDecimals(1.23)).toBe(1.23);
    });

    it("handles zero", () => {
      expect(roundToTwoDecimals(0)).toBe(0);
    });

    it("handles whole numbers", () => {
      expect(roundToTwoDecimals(5)).toBe(5);
    });
  });
});
