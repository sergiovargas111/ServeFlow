import { DEFAULT_BUDGET_SETTINGS, TIP_OUT_BASES, type BudgetSettings, type TipOutBasis, type TipOutRule } from "./types";

// Mapping between budget_settings rows and BudgetSettings.

export const BUDGET_COLUMNS =
  "bar_pct, bar_basis, busser_pct, busser_basis, host_pct, host_basis, split_bills, split_savings, split_spending, split_taxes";

export interface BudgetRow {
  bar_pct: number | string;
  bar_basis: string;
  busser_pct: number | string;
  busser_basis: string;
  host_pct: number | string;
  host_basis: string;
  split_bills: number;
  split_savings: number;
  split_spending: number;
  split_taxes: number;
}

function rule(pct: number | string, basis: string): TipOutRule {
  return {
    bp: Math.round(Number(pct) * 100),
    basis: (TIP_OUT_BASES as readonly string[]).includes(basis) ? (basis as TipOutBasis) : "tips",
  };
}

/** A missing row means the user hasn't saved settings yet: use the defaults. */
export function rowToSettings(row: BudgetRow | null | undefined): BudgetSettings {
  if (!row) return DEFAULT_BUDGET_SETTINGS;
  const split = {
    bills: Number(row.split_bills),
    savings: Number(row.split_savings),
    spending: Number(row.split_spending),
    taxes: Number(row.split_taxes),
  };
  const total = split.bills + split.savings + split.spending + split.taxes;
  return {
    tipOuts: {
      bar: rule(row.bar_pct, row.bar_basis),
      busser: rule(row.busser_pct, row.busser_basis),
      host: rule(row.host_pct, row.host_basis),
    },
    // The database enforces 100; fall back rather than divide by a bad split.
    split: total === 100 ? split : DEFAULT_BUDGET_SETTINGS.split,
  };
}

/** Upsert payload. user_id always comes from the verified session. */
export function settingsToRow(settings: BudgetSettings, userId: string) {
  const { tipOuts: t, split } = settings;
  return {
    user_id: userId,
    bar_pct: t.bar.bp / 100,
    bar_basis: t.bar.basis,
    busser_pct: t.busser.bp / 100,
    busser_basis: t.busser.basis,
    host_pct: t.host.bp / 100,
    host_basis: t.host.basis,
    split_bills: split.bills,
    split_savings: split.savings,
    split_spending: split.spending,
    split_taxes: split.taxes,
  };
}
