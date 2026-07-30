// NZ GST is 15%. Every amount in this app is NZD to two decimal places.
//
// These figures MUST agree exactly with the GENERATED columns on api.quotes:
//
//   subtotal = CASE WHEN gst_inclusive THEN ROUND(items_sum * 20 / 23, 2)
//                   ELSE items_sum END
//   gst      = CASE WHEN gst_inclusive THEN ROUND(items_sum * 3 / 23, 2)
//                   ELSE ROUND(items_sum * 15 / 100, 2) END
//   total    = CASE WHEN gst_inclusive THEN items_sum
//                   ELSE ROUND(items_sum * 115 / 100, 2) END
//
// The tradie sees the values computed here; the customer opening the shared
// /q/[slug] link sees the database's, because lib/supabase/quotes.ts maps
// subtotal/gst/total straight off the row. Postgres evaluates the expressions
// above on NUMERIC — exact decimal, ties away from zero — so computing the
// same thing with `Math.round(value * 100) / 100` on IEEE-754 floats produced
// a one-cent disagreement on roughly 1.3% of amounts: $1.50 showed GST $0.22
// to the tradie and $0.23 to the customer, $33.30 showed $4.99 against $5.00.
//
// So: work in integer cents and round the way Postgres does.

/** Amounts are 2dp money, so this is exact for every value the app produces. */
function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * round(a / b) to the nearest integer, ties away from zero — the rule
 * PostgreSQL's ROUND() applies to NUMERIC. `a` and `b` must be integers,
 * `b` positive.
 */
function divideRound(a: number, b: number): number {
  return a >= 0
    ? Math.floor((2 * a + b) / (2 * b))
    : -Math.floor((-2 * a + b) / (2 * b));
}

// GST out of a tax-inclusive amount is 3/23 of it; the net is 20/23. Kept as
// integer ratios rather than 1/(1 + GST_RATE) so the arithmetic stays exact
// and mirrors the SQL above literally.
function inclusiveGstCents(cents: number): number {
  return divideRound(cents * 3, 23);
}

function inclusiveNetCents(cents: number): number {
  return divideRound(cents * 20, 23);
}

function exclusiveGstCents(cents: number): number {
  return divideRound(cents * 15, 100);
}

function exclusiveGrossCents(cents: number): number {
  return divideRound(cents * 115, 100);
}

export function calculateGST(amount: number, inclusive: boolean): number {
  const cents = toCents(amount);
  return fromCents(inclusive ? inclusiveGstCents(cents) : exclusiveGstCents(cents));
}

export function calculateSubtotal(amount: number, inclusive: boolean): number {
  const cents = toCents(amount);
  return fromCents(inclusive ? inclusiveNetCents(cents) : cents);
}

/**
 * Generic sum of two already-computed figures. Unlike the functions above this
 * has no database counterpart and its inputs are not necessarily 2dp, so it
 * rounds the sum rather than working in cents.
 */
export function calculateTotal(subtotal: number, gst: number): number {
  return roundToTwo(subtotal + gst);
}

export function addGST(amount: number): number {
  return fromCents(exclusiveGrossCents(toCents(amount)));
}

export function removeGST(amount: number): number {
  return fromCents(inclusiveNetCents(toCents(amount)));
}

export function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Line-item total. Kept as a float round rather than integer cents because
 * quantity × unitPrice is not itself 2dp, and /api/quotes applies exactly this
 * formula before writing the row — the two must not drift apart.
 */
export function calculateItemTotal(quantity: number, unitPrice: number): number {
  return roundToTwo(quantity * unitPrice);
}

export function calculateQuoteTotals(
  items: { quantity: number; unitPrice: number }[],
  gstInclusive: boolean
): { subtotal: number; gst: number; total: number } {
  // Round each line item to cents before summing, then sum as integers, so the
  // running total cannot accumulate float error. /api/quotes derives items_sum
  // the same way.
  const itemsSumCents = items.reduce(
    (sum, item) => sum + toCents(calculateItemTotal(item.quantity, item.unitPrice)),
    0
  );

  if (gstInclusive) {
    return {
      subtotal: fromCents(inclusiveNetCents(itemsSumCents)),
      gst: fromCents(inclusiveGstCents(itemsSumCents)),
      total: fromCents(itemsSumCents),
    };
  }

  return {
    subtotal: fromCents(itemsSumCents),
    gst: fromCents(exclusiveGstCents(itemsSumCents)),
    total: fromCents(exclusiveGrossCents(itemsSumCents)),
  };
}

export const __testing = { divideRound };
