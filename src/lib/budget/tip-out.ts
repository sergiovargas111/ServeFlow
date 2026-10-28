import { TIP_OUT_ROLES, type BudgetSettings, type TipOutRole } from "./types";

export interface TipOutLine {
  role: TipOutRole;
  cents: number;
}

export interface TipOutResult {
  totalCents: number;
  lines: TipOutLine[];
  /** A sales-based tip-out is set but no sales amount was given, so it was left out. */
  missingSales: boolean;
}

/** cents × bp / 10,000, rounded half up. Inputs are non-negative integers. */
export function percentOf(cents: number, bp: number): number {
  return Math.floor((cents * bp + 5_000) / 10_000);
}

/**
 * What a shift owes in tip-outs under the user's settings. Each role is
 * computed from its own basis (tips or sales). The total never exceeds the
 * tips themselves: if it would, the last roles are trimmed so take-home is 0,
 * never negative.
 */
export function computeTipOut(settings: BudgetSettings, grossCents: number, salesCents: number | null): TipOutResult {
  let remaining = grossCents;
  let missingSales = false;
  const lines: TipOutLine[] = [];

  for (const role of TIP_OUT_ROLES) {
    const rule = settings.tipOuts[role];
    if (rule.bp <= 0) continue;
    if (rule.basis === "sales" && salesCents === null) {
      missingSales = true;
      continue;
    }
    const base = rule.basis === "tips" ? grossCents : salesCents!;
    const cents = Math.min(percentOf(base, rule.bp), remaining);
    remaining -= cents;
    lines.push({ role, cents });
  }

  return { totalCents: grossCents - remaining, lines, missingSales };
}
