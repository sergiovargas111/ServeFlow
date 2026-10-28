import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/shifts/dates";
import type { ShiftRecord, ShiftTag, ShiftType } from "@/lib/shifts/types";
import { safeToSpendCents, seasonalSlowWeeks, usualSlots, weekOutlook } from "./outlook";

const WED = "2026-10-07"; // this week runs Mon Oct 5 – Sun Oct 11
const MON = "2026-10-05";
const FRI = "2026-10-09";
const SPLIT = { bills: 50, savings: 10, spending: 25, taxes: 15 };

function shift(date: string, dollars: number, type: ShiftType = "dinner", tags: ShiftTag[] = []): ShiftRecord {
  return { date, shiftType: type, grossCents: dollars * 100, tipOutCents: 0, tags };
}

/** One shift a week for `weeks` weeks, the last one 7 days before `firstThisWeek`. */
function weeklyBefore(firstThisWeek: string, weeks: number, dollars: number, type: ShiftType = "dinner") {
  return Array.from({ length: weeks }, (_, i) => shift(addDays(firstThisWeek, -7 * (i + 1)), dollars, type));
}

/** 8 weeks of Monday dinners ($100) and Friday dinners ($200) before this week. */
const regular = [...weeklyBefore(MON, 8, 100), ...weeklyBefore(FRI, 8, 200)];

describe("usualSlots", () => {
  it("finds the weekday + shift type combos worked most weeks", () => {
    expect(usualSlots(regular, WED)).toEqual([
      { dayOfWeek: 1, shiftType: "dinner" },
      { dayOfWeek: 5, shiftType: "dinner" },
    ]);
  });

  it("leaves out occasional pickups", () => {
    const pickups = [shift("2026-09-23", 90, "lunch"), shift("2026-09-02", 90, "lunch")]; // 2 of 8 Wednesdays
    expect(usualSlots([...regular, ...pickups], WED)).toHaveLength(2);
  });

  it("is empty with no shifts", () => {
    expect(usualSlots([], WED)).toEqual([]);
  });

  it("needs at least 2 full weeks of history", () => {
    expect(usualSlots(weeklyBefore(FRI, 1, 200), WED)).toEqual([]);
    expect(usualSlots(weeklyBefore(FRI, 2, 200), WED)).toHaveLength(1);
  });

  it("ignores holiday shifts", () => {
    const holidays = weeklyBefore("2026-10-08", 8, 300, "lunch").map((s) => ({ ...s, tags: ["holiday" as const] }));
    expect(usualSlots(holidays, WED)).toEqual([]);
  });
});

describe("weekOutlook", () => {
  it("projects the week from what's earned plus the typical shifts ahead", () => {
    const o = weekOutlook([...regular, shift(MON, 100)], WED);
    expect(o).toMatchObject({
      weekStart: MON,
      earnedCents: 10_000,
      expectedRemainingCents: 20_000,
      remainingShifts: 1,
      projectedCents: 30_000,
      conservativeCents: 26_000, // $100 + 80% of $200
      typicalWeekCents: 30_000,
      slow: false,
    });
  });

  it("shows a typical range for the week, not just one number", () => {
    const varied = [...weeklyBefore(MON, 8, 100), ...[150, 250, 150, 250, 150, 250, 150, 250].map((d, i) => shift(addDays(FRI, -7 * (i + 1)), d))];
    const o = weekOutlook([...varied, shift(MON, 100)], WED);
    expect(o.projectedLowCents).toBeLessThan(o.projectedCents);
    expect(o.projectedHighCents).toBeGreaterThan(o.projectedCents);
  });

  it("flags a week tracking under 85% of typical", () => {
    const o = weekOutlook([...regular, shift(MON, 40)], WED);
    expect(o.projectedCents).toBe(24_000);
    expect(o.slow).toBe(true);
  });

  it("counts a usual shift that was skipped this week as nothing earned", () => {
    // Monday wasn't worked: $0 + $200 Friday vs a $300 typical week.
    expect(weekOutlook(regular, WED).slow).toBe(true);
  });

  it("doesn't count a shift ahead once it's been logged", () => {
    const o = weekOutlook([...regular, shift(MON, 100), shift(FRI, 260)], FRI);
    expect(o).toMatchObject({ earnedCents: 36_000, expectedRemainingCents: 0, remainingShifts: 0, slow: false });
  });

  it("still counts today's usual shift before it's logged", () => {
    expect(weekOutlook([...regular, shift(MON, 100)], FRI).remainingShifts).toBe(1);
  });

  it("has no typical week and never flags slow for a new user", () => {
    expect(weekOutlook([], WED)).toMatchObject({ earnedCents: 0, typicalWeekCents: null, projectedCents: 0, slow: false });
    expect(weekOutlook([shift(MON, 80)], WED)).toMatchObject({ earnedCents: 8_000, typicalWeekCents: null, slow: false });
  });

  it("ignores future-dated shifts", () => {
    expect(weekOutlook([...regular, shift(MON, 100), shift(FRI, 999)], WED).earnedCents).toBe(10_000);
  });
});

describe("safeToSpendCents", () => {
  it("is the spending share of the conservative week", () => {
    const o = weekOutlook([...regular, shift(MON, 100)], WED);
    expect(safeToSpendCents(o, SPLIT)).toBe(6_500); // 25% of $260
  });

  it("is zero when nothing is earned or expected", () => {
    expect(safeToSpendCents(weekOutlook([], WED), SPLIT)).toBe(0);
  });
});

describe("seasonalSlowWeeks", () => {
  // Friday dinners every week Sep 5 – Nov 28, 2025 at $200.
  const lastYear = Array.from({ length: 13 }, (_, i) => shift(addDays("2025-09-05", 7 * i), 200));
  const withSlow = lastYear.map((s) => (s.date === "2025-10-24" ? { ...s, grossCents: 10_000 } : s));

  it("warns about an upcoming week that was slow the same time last year", () => {
    // 2026-10-19 lines up with the week of 2025-10-20 (52 weeks back).
    expect(seasonalSlowWeeks(withSlow, WED)).toEqual([{ weekStart: "2026-10-19", pctBelow: 50 }]);
  });

  it("says nothing when last year was steady", () => {
    expect(seasonalSlowWeeks(lastYear, WED)).toEqual([]);
  });

  it("skips weeks with no shifts last year (time off isn't a slow week)", () => {
    expect(seasonalSlowWeeks(lastYear.filter((s) => s.date !== "2025-10-24"), WED)).toEqual([]);
  });

  it("needs a year of history", () => {
    expect(seasonalSlowWeeks(regular, WED)).toEqual([]);
    expect(seasonalSlowWeeks([], WED)).toEqual([]);
  });

  it("needs at least 4 comparison weeks around it", () => {
    const sparse = withSlow.filter((s) => ["2025-10-17", "2025-10-24", "2025-10-31", "2025-11-07"].includes(s.date));
    expect(seasonalSlowWeeks(sparse, WED)).toEqual([]);
  });
});
