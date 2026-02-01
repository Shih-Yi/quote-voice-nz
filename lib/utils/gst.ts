const GST_RATE = 0.15;

export function calculateGST(amount: number, inclusive: boolean): number {
  if (inclusive) {
    return roundToTwo(amount - amount / (1 + GST_RATE));
  }
  return roundToTwo(amount * GST_RATE);
}

export function calculateSubtotal(amount: number, inclusive: boolean): number {
  if (inclusive) {
    return roundToTwo(amount / (1 + GST_RATE));
  }
  return roundToTwo(amount);
}

export function calculateTotal(subtotal: number, gst: number): number {
  return roundToTwo(subtotal + gst);
}

export function addGST(amount: number): number {
  return roundToTwo(amount * (1 + GST_RATE));
}

export function removeGST(amount: number): number {
  return roundToTwo(amount / (1 + GST_RATE));
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateQuoteTotals(
  items: { quantity: number; unitPrice: number }[],
  gstInclusive: boolean
): { subtotal: number; gst: number; total: number } {
  const itemsTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  if (gstInclusive) {
    const subtotal = calculateSubtotal(itemsTotal, true);
    const gst = calculateGST(itemsTotal, true);
    return { subtotal, gst, total: itemsTotal };
  } else {
    const gst = calculateGST(itemsTotal, false);
    const total = calculateTotal(itemsTotal, gst);
    return { subtotal: itemsTotal, gst, total };
  }
}
