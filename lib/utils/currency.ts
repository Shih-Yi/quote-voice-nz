const NZD_FORMATTER = new Intl.NumberFormat("en-NZ", {
  style: "currency",
  currency: "NZD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNZD(amount: number): string {
  return NZD_FORMATTER.format(amount);
}

export function parseNZD(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}
