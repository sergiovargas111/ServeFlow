import { describe, expect, it } from "vitest";
import type { ShiftRecord } from "@/lib/shifts/types";
import { averagePerShift, monthlyTotals, projectedMonthly, weeklyTotals } from "./trends";

const TODAY = "2026-10-04"; // a Sunday; its week starts Mon Sep 28

function shift(date: string, dollars: number, tipOut = 0): ShiftRecord {
  return { date, shiftType: "dinner", grossCents: dollars * 100, tipOutCents: tipOut * 100, tags: [] };
}

describe("weeklyTotals", () => {
  it("returns the requested number of Monday-start weeks, oldest first", () => {
    const weeks = weeklyTotals([], TODAY, 8);
    expect(weeks).toHaveLength(8);
    expect(weeks[7].key).toBe("2026-09-28");
    expect(weeks[0].key).toBe("2026-08-10");
    expect(weeks[7].label).toBe("Sep 28");
  });

  it("sums take-home per week and counts shifts", () => {
    const weeks = weeklyTotals(
      [shift("2026-09-28", 100), shift("2026-10-04", 50, 10), shift("2026-09-27", 70)],
      TODAY,
      2,
    );
    expect(weeks).toEqual([
      { key: "2026-09-21", label: "Sep 21", totalCents: 7000, shifts: 1 },
      { key: "2026-09-28", label: "Sep 28", totalCents: 14000, shifts: 2 },
    ]);
  });

  it("shows empty weeks as zero instead of skipping them", () => {
    expect(weeklyTotals([shift("2026-09-28", 100)], TODAY, 3).map((w) => w.totalCents)).toEqual([0, 0, 10000]);
  });

  it("ignores shifts outside the window and in the future", () => {
    const weeks = weeklyTotals([shift("2025-01-01", 999), shift("2026-10-05", 999)], TODAY, 8);
    expect(weeks.every((w) => w.totalCents === 0)).toBe(true);
  });
});

describe("monthlyTotals", () => {
  it("returns calendar months oldest first, across a year boundary", () => {
    const months = monthlyTotals([], "2026-02-10", 4);
    expect(months.map((m) => m.key)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(months.map((m) => m.label)).toEqual(["Nov", "Dec", "Jan", "Feb"]);
  });

  it("sums take-home per month", () => {
    const months = monthlyTotals([shift("2026-09-30", 100), shift("2026-10-01", 80, 5)], TODAY, 2);
    expect(months.map((m) => m.totalCents)).toEqual([10000, 7500]);
  });
});

describe("averagePerShift", () => {
  it("returns null with no shifts", () => {
    expect(averagePerShift([])).toBeNull();
  });

  it("averages take-home per shift, rounded to cents", () => {
    expect(averagePerShift([shift("2026-10-01", 100), shift("2026-10-02", 151, 1)])).toBe(12500);
  });

  it("counts zero-tip nights", () => {
    expect(averagePerShift([shift("2026-10-01", 0), shift("2026-10-02", 200)])).toBe(10000);
  });
});

describe("projectedMonthly", () => {
  it("returns null with no shifts", () => {
    expect(projectedMonthly([], TODAY)).toBeNull();
  });

  it("returns null with under 14 days of history", () => {
    expect(projectedMonthly([shift("2026-09-25", 500)], TODAY)).toBeNull();
  });

  it("projects from the daily average since the first shift", () => {
    // 14 days (Sep 21 - Oct 4) with $1,400 take-home = $100/day
    const p = projectedMonthly([shift("2026-09-21", 700), shift("2026-10-01", 700)], TODAY);
    expect(p).toEqual({ basisDays: 14, monthlyCents: Math.round(10000 * (365.25 / 12)) });
  });

  it("only uses the last 56 days once there is more history", () => {
    const old = shift("2026-01-05", 100000); // a huge old night outside the window
    const p = projectedMonthly([old, shift("2026-09-01", 560)], TODAY);
    expect(p?.basisDays).toBe(56);
    expect(p?.monthlyCents).toBe(Math.round((56000 / 56) * (365.25 / 12)));
  });

  it("ignores future-dated shifts", () => {
    const p = projectedMonthly([shift("2026-09-21", 700), shift("2026-10-20", 99999)], TODAY);
    expect(p?.monthlyCents).toBe(Math.round((70000 / 14) * (365.25 / 12)));
  });
});
