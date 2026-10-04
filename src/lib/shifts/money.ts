/** Largest amount accepted for any single tip field: $10,000.00. */
export const MAX_AMOUNT_CENTS = 1_000_000;

const MONEY = /^\$?\s*(\d{1,7})(?:\.(\d{1,2}))?$/;

/**
 * Parses a typed dollar amount ("85", "85.5", "$85.50") into integer cents.
 * Returns null for anything else: negatives, letters, commas, more than two
 * decimals, or amounts over the maximum. Integer cents keep sums exact.
 */
export function parseMoneyToCents(input: string): number | null {
  const match = MONEY.exec(input.trim());
  if (!match) return null;
  const dollars = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const total = dollars * 100 + cents;
  return total <= MAX_AMOUNT_CENTS ? total : null;
}

/** Cents to a dollars number for the database's numeric(10,2) columns. */
export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

/** Database numeric (number or string) to integer cents. */
export function dollarsToCents(value: number | string): number {
  return Math.round(Number(value) * 100);
}

const whole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** "$1,235" (rounded), or "$1,234.50" with exact: true. */
export function formatCents(cents: number, { exact: showCents = false } = {}): string {
  return (showCents ? exact : whole).format(cents / 100);
}
