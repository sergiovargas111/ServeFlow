import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/shifts/dates";
import type { ShiftRecord } from "@/lib/shifts/types";
import { buildBudgetView } from "./summary";
import { DEFAULT_BUDGET_SETTINGS, type BudgetSettings } from "./types";

const WED = "2026-10-07";

function dinner(date: string, dollars: number, tipOut = 0): ShiftRecord {
  return { date, shiftType: "dinner", grossCents: dollars * 100, tipOutCents: tipOut * 100, tags: [] };
}

const weeks = (first: string, n: number, dollars: number) =>
  Array.from({ length: n }, (_, i) => dinner(addDays(first, -7 * (i + 1)), dollars));

describe("buildBudgetView", () => {
  it("handles a brand-new user", () => {
    const v = buildBudgetView([], DEFAULT_BUDGET_SETTINGS, WED);
    expect(v).toMatchObject({ safeToSpendCents: 0, alerts: [], latest: null, month: null, tipOuts: [] });
  });

  it("splits the latest shift's take-home (after tip-out) into buckets", () => {
    const v = buildBudgetView([dinner("2026-10-05", 220, 20)], DEFAULT_BUDGET_SETTINGS, WED);
    expect(v.latest).toEqual({
      date: "2026-10-05",
      takeHomeCents: 20_000,
      parts: { bills: 10_000, savings: 2_000, spending: 5_000, taxes: 3_000 },
    });
  });

  it("projects and splits a typical month once there are 2 weeks of history", () => {
    const shifts = [...weeks("2026-10-05", 8, 100), ...weeks("2026-10-09", 8, 200)];
    const v = buildBudgetView(shifts, DEFAULT_BUDGET_SETTINGS, WED);
    expect(v.month).not.toBeNull();
    const parts = v.month!.parts;
    expect(parts.bills + parts.savings + parts.spending + parts.taxes).toBe(v.month!.projection.monthlyCents);
  });

  it("includes a neutral slow-week alert when the week is running light", () => {
    const shifts = [...weeks("2026-10-05", 8, 100), ...weeks("2026-10-09", 8, 200), dinner("2026-10-05", 30)];
    const v = buildBudgetView(shifts, DEFAULT_BUDGET_SETTINGS, WED);
    expect(v.alerts.map((a) => a.headline)).toContain("This week is running lighter than usual");
  });

  it("lists the user's tip-outs in plain words", () => {
    const settings: BudgetSettings = {
      ...DEFAULT_BUDGET_SETTINGS,
      tipOuts: { bar: { bp: 500, basis: "tips" }, busser: { bp: 150, basis: "sales" }, host: { bp: 0, basis: "tips" } },
    };
    expect(buildBudgetView([], settings, WED).tipOuts).toEqual(["Bar: 5% of tips", "Busser / runner: 1.5% of sales"]);
  });

  it("uses the user's own split for safe to spend", () => {
    const shifts = [...weeks("2026-10-05", 8, 100), ...weeks("2026-10-09", 8, 200), dinner("2026-10-05", 100)];
    const allSpending = { ...DEFAULT_BUDGET_SETTINGS, split: { bills: 0, savings: 0, spending: 100, taxes: 0 } };
    expect(buildBudgetView(shifts, allSpending, WED).safeToSpendCents).toBe(26_000);
  });
});
