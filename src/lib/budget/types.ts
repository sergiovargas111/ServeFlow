// Budget settings: tip-outs owed to support staff and how each night's
// take-home is split. Percentages are kept as integer basis points
// (1% = 100 bp) so all money math stays in exact integers.

export const TIP_OUT_ROLES = ["bar", "busser", "host"] as const;
export type TipOutRole = (typeof TIP_OUT_ROLES)[number];

export const TIP_OUT_ROLE_LABELS: Record<TipOutRole, string> = {
  bar: "Bar",
  busser: "Busser / runner",
  host: "Host",
};

/** A tip-out is a % of the server's tips or a % of their sales. */
export const TIP_OUT_BASES = ["tips", "sales"] as const;
export type TipOutBasis = (typeof TIP_OUT_BASES)[number];

export interface TipOutRule {
  bp: number;
  basis: TipOutBasis;
}

export const SPLIT_BUCKETS = ["bills", "savings", "spending", "taxes"] as const;
export type SplitBucket = (typeof SPLIT_BUCKETS)[number];

export const SPLIT_LABELS: Record<SplitBucket, string> = {
  bills: "Bills",
  savings: "Savings",
  spending: "Spending",
  taxes: "Taxes (set aside)",
};

/** Whole percentages per bucket; they always add up to 100. */
export type Split = Record<SplitBucket, number>;

export interface BudgetSettings {
  tipOuts: Record<TipOutRole, TipOutRule>;
  split: Split;
}

/** Caps, mirrored by CHECK constraints in the budget_settings migration. */
export const MAX_TIPS_BP = 10_000; // 100% of tips, all roles combined
export const MAX_SALES_BP = 2_000; // 20% of sales per role

/** Starting point until the user saves their own. No tip-out, a simple split. */
export const DEFAULT_BUDGET_SETTINGS: BudgetSettings = {
  tipOuts: {
    bar: { bp: 0, basis: "tips" },
    busser: { bp: 0, basis: "tips" },
    host: { bp: 0, basis: "tips" },
  },
  split: { bills: 50, savings: 10, spending: 25, taxes: 15 },
};

export function hasTipOuts(settings: BudgetSettings): boolean {
  return TIP_OUT_ROLES.some((r) => settings.tipOuts[r].bp > 0);
}

export function needsSales(settings: BudgetSettings): boolean {
  return TIP_OUT_ROLES.some((r) => settings.tipOuts[r].bp > 0 && settings.tipOuts[r].basis === "sales");
}

/** "2.5%" from 250 bp. */
export function formatBp(bp: number): string {
  return `${Number((bp / 100).toFixed(2))}%`;
}
