import { describe, expect, it } from "vitest";
import { computeTipOut, percentOf } from "./tip-out";
import { DEFAULT_BUDGET_SETTINGS, type BudgetSettings, type TipOutRule } from "./types";

function settings(tipOuts: Partial<Record<"bar" | "busser" | "host", TipOutRule>>): BudgetSettings {
  return { ...DEFAULT_BUDGET_SETTINGS, tipOuts: { ...DEFAULT_BUDGET_SETTINGS.tipOuts, ...tipOuts } };
}

describe("percentOf", () => {
  it("takes a percentage of cents in basis points", () => {
    expect(percentOf(20_000, 500)).toBe(1_000); // 5% of $200
    expect(percentOf(18_550, 250)).toBe(464); // 2.5% of $185.50 = $4.6375
  });

  it("rounds half up to the nearest cent", () => {
    expect(percentOf(10, 5_000)).toBe(5);
    expect(percentOf(1, 5_000)).toBe(1); // 0.5¢ → 1¢
    expect(percentOf(1, 4_999)).toBe(0);
  });

  it("is zero for zero tips or zero percent", () => {
    expect(percentOf(0, 1_000)).toBe(0);
    expect(percentOf(50_000, 0)).toBe(0);
  });
});

describe("computeTipOut", () => {
  it("owes nothing with default settings", () => {
    expect(computeTipOut(DEFAULT_BUDGET_SETTINGS, 20_000, null)).toEqual({ totalCents: 0, lines: [], missingSales: false });
  });

  it("adds up tip-based roles", () => {
    const s = settings({ bar: { bp: 500, basis: "tips" }, busser: { bp: 300, basis: "tips" } });
    const r = computeTipOut(s, 20_000, null);
    expect(r.totalCents).toBe(1_600);
    expect(r.lines).toEqual([
      { role: "bar", cents: 1_000 },
      { role: "busser", cents: 600 },
    ]);
  });

  it("computes sales-based roles from sales, not tips", () => {
    const s = settings({ busser: { bp: 150, basis: "sales" } });
    expect(computeTipOut(s, 20_000, 100_000).totalCents).toBe(1_500); // 1.5% of $1,000 sales
  });

  it("skips a sales-based role and flags it when sales weren't entered", () => {
    const s = settings({ bar: { bp: 500, basis: "tips" }, host: { bp: 100, basis: "sales" } });
    const r = computeTipOut(s, 20_000, null);
    expect(r).toEqual({ totalCents: 1_000, lines: [{ role: "bar", cents: 1_000 }], missingSales: true });
  });

  it("never takes more than the tips themselves", () => {
    // 3% of $2,000 sales = $60, but the server only made $40.
    const s = settings({ bar: { bp: 2_000, basis: "sales" }, busser: { bp: 300, basis: "sales" } });
    const r = computeTipOut(s, 4_000, 200_000);
    expect(r.totalCents).toBe(4_000);
    expect(r.lines).toEqual([
      { role: "bar", cents: 4_000 },
      { role: "busser", cents: 0 },
    ]);
  });

  it("handles a zero-tip night", () => {
    const s = settings({ bar: { bp: 500, basis: "tips" }, busser: { bp: 200, basis: "sales" } });
    expect(computeTipOut(s, 0, 50_000).totalCents).toBe(0);
  });
});
