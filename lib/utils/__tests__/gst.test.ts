import { describe, it, expect } from "vitest";
import {
  calculateGST,
  calculateSubtotal,
  calculateTotal,
  addGST,
  removeGST,
  calculateQuoteTotals,
} from "../gst";

describe("GST calculations", () => {
  describe("calculateGST", () => {
    it("calculates GST from an exclusive amount", () => {
      expect(calculateGST(100, false)).toBe(15);
      expect(calculateGST(200, false)).toBe(30);
      expect(calculateGST(0, false)).toBe(0);
    });

    it("extracts GST from an inclusive amount", () => {
      // $115 inclusive → GST = 115 - (115 / 1.15) = 115 - 100 = 15
      expect(calculateGST(115, true)).toBe(15);
      expect(calculateGST(230, true)).toBe(30);
      expect(calculateGST(0, true)).toBe(0);
    });

    it("rounds to two decimal places", () => {
      // 33.33 * 0.15 = 4.9995 → 5.00
      expect(calculateGST(33.33, false)).toBe(5);
      // Inclusive: 99.99 - (99.99 / 1.15) = 99.99 - 86.947826... = 13.042...
      expect(calculateGST(99.99, true)).toBe(13.04);
    });
  });

  describe("calculateSubtotal", () => {
    it("returns the amount itself when exclusive", () => {
      expect(calculateSubtotal(100, false)).toBe(100);
      expect(calculateSubtotal(250.5, false)).toBe(250.5);
    });

    it("removes GST from inclusive amount to get subtotal", () => {
      // 115 / 1.15 = 100
      expect(calculateSubtotal(115, true)).toBe(100);
      expect(calculateSubtotal(230, true)).toBe(200);
    });
  });

  describe("calculateTotal", () => {
    it("sums subtotal and GST", () => {
      expect(calculateTotal(100, 15)).toBe(115);
      expect(calculateTotal(200, 30)).toBe(230);
      expect(calculateTotal(0, 0)).toBe(0);
    });

    it("rounds to two decimal places", () => {
      expect(calculateTotal(100.555, 15.083)).toBe(115.64);
    });
  });

  describe("addGST", () => {
    it("adds 15% GST to amount", () => {
      expect(addGST(100)).toBe(115);
      expect(addGST(200)).toBe(230);
      expect(addGST(0)).toBe(0);
    });
  });

  describe("removeGST", () => {
    it("removes 15% GST from inclusive amount", () => {
      expect(removeGST(115)).toBe(100);
      expect(removeGST(230)).toBe(200);
    });
  });

  describe("calculateQuoteTotals", () => {
    it("calculates totals for GST exclusive items", () => {
      const items = [
        { quantity: 2, unitPrice: 50 },
        { quantity: 1, unitPrice: 100 },
      ];
      const result = calculateQuoteTotals(items, false);
      // Subtotal = (2*50) + (1*100) = 200
      // GST = 200 * 0.15 = 30
      // Total = 230
      expect(result.subtotal).toBe(200);
      expect(result.gst).toBe(30);
      expect(result.total).toBe(230);
    });

    it("calculates totals for GST inclusive items", () => {
      const items = [
        { quantity: 1, unitPrice: 115 },
      ];
      const result = calculateQuoteTotals(items, true);
      // Items total = 115 (inclusive)
      // Subtotal = 115 / 1.15 = 100
      // GST = 15
      // Total = 115 (the original amount)
      expect(result.subtotal).toBe(100);
      expect(result.gst).toBe(15);
      expect(result.total).toBe(115);
    });

    it("handles empty items array", () => {
      const result = calculateQuoteTotals([], false);
      expect(result.subtotal).toBe(0);
      expect(result.gst).toBe(0);
      expect(result.total).toBe(0);
    });

    it("rounds each line item individually before summing", () => {
      const items = [
        { quantity: 3, unitPrice: 33.33 },  // 99.99
        { quantity: 1, unitPrice: 0.01 },    // 0.01
      ];
      const result = calculateQuoteTotals(items, false);
      expect(result.subtotal).toBe(100);
      expect(result.gst).toBe(15);
      expect(result.total).toBe(115);
    });
  });
});
