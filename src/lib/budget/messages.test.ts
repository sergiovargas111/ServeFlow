import { describe, expect, it } from "vitest";
import { seasonalAlert, slowWeekAlert } from "./messages";
import type { WeekOutlook } from "./outlook";

const base: WeekOutlook = {
  weekStart: "2026-10-05",
  earnedCents: 4_000,
  expectedRemainingCents: 20_000,
  remainingShifts: 1,
  projectedCents: 24_000,
  projectedLowCents: 22_000,
  projectedHighCents: 26_000,
  conservativeCents: 20_000,
  typicalWeekCents: 30_000,
  slow: true,
};

const SHAMING = /fail|bad|poor|missed|behind|worse|terrible|disappoint/i;

describe("slowWeekAlert", () => {
  it("gives a neutral heads-up for a slow week", () => {
    const a = slowWeekAlert(base)!;
    expect(a.headline).toBe("This week is running lighter than usual");
    expect(a.detail).toContain("$240");
    expect(a.detail).toContain("$300");
    expect(a.detail).toContain("based on your history");
    expect(`${a.headline} ${a.detail}`).not.toMatch(SHAMING);
  });

  it("says nothing for a normal week", () => {
    expect(slowWeekAlert({ ...base, slow: false })).toBeNull();
  });

  it("says nothing without a typical week to compare with", () => {
    expect(slowWeekAlert({ ...base, typicalWeekCents: null })).toBeNull();
  });
});

describe("seasonalAlert", () => {
  it("names the week and how much slower it was last year, neutrally", () => {
    const a = seasonalAlert({ weekStart: "2026-10-19", pctBelow: 32 });
    expect(a.headline).toBe("Heads up for the week of Oct 19");
    expect(a.detail).toContain("about 32% slower");
    expect(`${a.headline} ${a.detail}`).not.toMatch(SHAMING);
  });
});
