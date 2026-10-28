import { describe, expect, it } from "vitest";
import { DEFAULT_BUDGET_SETTINGS, formatBp, hasTipOuts, needsSales, type BudgetSettings } from "./types";

const withBusser = (basis: "tips" | "sales", bp = 150): BudgetSettings => ({
  ...DEFAULT_BUDGET_SETTINGS,
  tipOuts: { ...DEFAULT_BUDGET_SETTINGS.tipOuts, busser: { bp, basis } },
});

describe("budget settings helpers", () => {
  it("reports no tip-outs for the defaults", () => {
    expect(hasTipOuts(DEFAULT_BUDGET_SETTINGS)).toBe(false);
    expect(needsSales(DEFAULT_BUDGET_SETTINGS)).toBe(false);
  });

  it("needs sales only when a sales-based tip-out is above 0%", () => {
    expect(needsSales(withBusser("sales"))).toBe(true);
    expect(needsSales(withBusser("tips"))).toBe(false);
    expect(needsSales(withBusser("sales", 0))).toBe(false);
    expect(hasTipOuts(withBusser("tips"))).toBe(true);
  });

  it("formats basis points as a short percentage", () => {
    expect(formatBp(500)).toBe("5%");
    expect(formatBp(150)).toBe("1.5%");
    expect(formatBp(255)).toBe("2.55%");
    expect(formatBp(0)).toBe("0%");
  });

  it("defaults to a split that adds up to 100", () => {
    const s = DEFAULT_BUDGET_SETTINGS.split;
    expect(s.bills + s.savings + s.spending + s.taxes).toBe(100);
  });
});
