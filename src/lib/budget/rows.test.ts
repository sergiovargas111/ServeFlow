import { describe, expect, it } from "vitest";
import { rowToSettings, settingsToRow, type BudgetRow } from "./rows";
import { DEFAULT_BUDGET_SETTINGS, type BudgetSettings } from "./types";

const settings: BudgetSettings = {
  tipOuts: {
    bar: { bp: 500, basis: "tips" },
    busser: { bp: 150, basis: "sales" },
    host: { bp: 0, basis: "tips" },
  },
  split: { bills: 40, savings: 20, spending: 25, taxes: 15 },
};

describe("budget rows", () => {
  it("uses the defaults when the user hasn't saved settings", () => {
    expect(rowToSettings(null)).toEqual(DEFAULT_BUDGET_SETTINGS);
    expect(rowToSettings(undefined)).toEqual(DEFAULT_BUDGET_SETTINGS);
  });

  it("round-trips settings through a database row (numeric columns come back as strings)", () => {
    const row = settingsToRow(settings, "user-a");
    const fromDb = { ...row, bar_pct: "5.00", busser_pct: "1.50", host_pct: "0.00" } as BudgetRow;
    expect(rowToSettings(fromDb)).toEqual(settings);
  });

  it("writes percentages with two decimals and the session user", () => {
    expect(settingsToRow(settings, "user-a")).toMatchObject({ user_id: "user-a", bar_pct: 5, busser_pct: 1.5, busser_basis: "sales" });
  });

  it("falls back to safe values for a corrupt row", () => {
    const row = { ...settingsToRow(settings, "u"), bar_basis: "covers", split_bills: 90 } as BudgetRow;
    const s = rowToSettings(row);
    expect(s.tipOuts.bar.basis).toBe("tips");
    expect(s.split).toEqual(DEFAULT_BUDGET_SETTINGS.split);
  });
});
