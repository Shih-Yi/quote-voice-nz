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

  // The tradie reads these numbers; the customer opening /q/[slug] reads the
  // database's GENERATED columns. They have to be the same numbers.
  //
  //   subtotal = gst_inclusive ? ROUND(items_sum * 20 / 23, 2) : items_sum
  //   gst      = gst_inclusive ? ROUND(items_sum * 3 / 23, 2)
  //                            : ROUND(items_sum * 15 / 100, 2)
  //   total    = gst_inclusive ? items_sum : ROUND(items_sum * 115 / 100, 2)
  //
  // Postgres evaluates those on NUMERIC: exact decimal, ties away from zero.
  describe("agreement with the database's GENERATED columns", () => {
    /** Reference implementation of ROUND(a/b, 0) on exact integers. */
    function pgRound(a: number, b: number): number {
      return Math.floor((2 * a + b) / (2 * b));
    }

    function dbColumns(itemsSumCents: number, inclusive: boolean) {
      const S = itemsSumCents;
      return inclusive
        ? {
            subtotal: pgRound(S * 20, 23) / 100,
            gst: pgRound(S * 3, 23) / 100,
            total: S / 100,
          }
        : {
            subtotal: S / 100,
            gst: pgRound(S * 15, 100) / 100,
            total: pgRound(S * 115, 100) / 100,
          };
    }

    // Each of these produced a one-cent disagreement under the old
    // `Math.round(value * 100) / 100` implementation.
    it.each([
      [1.5, 0.22, 0.23],
      [3.3, 0.49, 0.5],
      [4.1, 0.61, 0.62],
      [33.3, 4.99, 5.0],
    ])(
      "$%s exclusive: was %s locally vs %s in the database",
      (amount, previouslyWrong, correct) => {
        const { gst } = calculateQuoteTotals(
          [{ quantity: 1, unitPrice: amount }],
          false
        );
        expect(gst).not.toBe(previouslyWrong);
        expect(gst).toBe(correct);
      }
    );

    it("matches the database on every amount from $0.01 to $1000, exclusive", () => {
      const mismatches: number[] = [];
      for (let cents = 1; cents <= 100_000; cents++) {
        const local = calculateQuoteTotals(
          [{ quantity: 1, unitPrice: cents / 100 }],
          false
        );
        const db = dbColumns(cents, false);
        if (
          local.subtotal !== db.subtotal ||
          local.gst !== db.gst ||
          local.total !== db.total
        ) {
          mismatches.push(cents / 100);
        }
      }
      expect(mismatches).toEqual([]);
    });

    it("matches the database on every amount from $0.01 to $1000, inclusive", () => {
      const mismatches: number[] = [];
      for (let cents = 1; cents <= 100_000; cents++) {
        const local = calculateQuoteTotals(
          [{ quantity: 1, unitPrice: cents / 100 }],
          true
        );
        const db = dbColumns(cents, true);
        if (
          local.subtotal !== db.subtotal ||
          local.gst !== db.gst ||
          local.total !== db.total
        ) {
          mismatches.push(cents / 100);
        }
      }
      expect(mismatches).toEqual([]);
    });

    it("keeps subtotal + gst equal to total in both modes", () => {
      for (let cents = 1; cents <= 20_000; cents++) {
        for (const inclusive of [true, false]) {
          const { subtotal, gst, total } = calculateQuoteTotals(
            [{ quantity: 1, unitPrice: cents / 100 }],
            inclusive
          );
          expect(Math.round(subtotal * 100) + Math.round(gst * 100)).toBe(
            Math.round(total * 100)
          );
        }
      }
    });

    it("does not accumulate float error across many line items", () => {
      // 0.1 + 0.2 + ... in floats drifts; summing cents does not.
      const items = Array.from({ length: 300 }, () => ({
        quantity: 1,
        unitPrice: 0.1,
      }));
      const { subtotal, gst, total } = calculateQuoteTotals(items, false);
      expect(subtotal).toBe(30);
      expect(gst).toBe(4.5);
      expect(total).toBe(34.5);
    });
  });
});
