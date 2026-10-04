import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/shifts/dates";
import type { ShiftRecord } from "@/lib/shifts/types";
import { runBacktest, sampleSizeBucket } from "./backtest";
import { generateSyntheticShifts } from "./synthetic";

function fridays(amounts: number[]): ShiftRecord[] {
  return amounts.map((a, i) => ({
    date: addDays("2026-07-03", 7 * i),
    shiftType: "dinner",
    grossCents: a * 100,
    tipOutCents: 0,
    tags: [],
  }));
}

describe("runBacktest", () => {
  it("returns an empty result for no shifts", () => {
    expect(runBacktest([])).toMatchObject({ shifts: 0, locked: 0, forecasts: 0, inRangePct: 0 });
  });

  it("can't forecast the first 4 comparable shifts", () => {
    expect(runBacktest(fridays([100, 100, 100, 100]))).toMatchObject({ shifts: 4, locked: 4, forecasts: 0 });
  });

  it("scores later shifts using only earlier ones", () => {
    // Forecast for #5 comes from [100,100,200,200]: p25 100, median 150, p75 200.
    const r = runBacktest(fridays([100, 100, 200, 200, 150]));
    expect(r).toMatchObject({ locked: 4, forecasts: 1, inRangePct: 100, maeCents: 0, medianApePct: 0 });
  });

  it("counts misses above and below the range and the error", () => {
    const r = runBacktest(fridays([100, 100, 200, 200, 400, 0]));
    // #5: 400 vs median 150 (above). #6: history [100,100,200,200,400] -> p25 100, median 200; 0 is below.
    expect(r).toMatchObject({ forecasts: 2, inRangePct: 0, aboveRangePct: 50, belowRangePct: 50 });
    expect(r.maeCents).toBe(Math.round((25000 + 20000) / 2));
  });

  it("breaks results down by shift type and sample size", () => {
    const r = runBacktest(fridays([100, 100, 200, 200, 150, 150]));
    expect(r.byShiftType.dinner?.forecasts).toBe(2);
    expect(r.bySampleSize["4-7"]?.forecasts).toBe(2);
  });
});

describe("sampleSizeBucket", () => {
  it("groups sample sizes", () => {
    expect([4, 7, 8, 11, 12, 16].map(sampleSizeBucket)).toEqual(["4-7", "4-7", "8-11", "8-11", "12-16", "12-16"]);
  });
});

describe("generateSyntheticShifts (SIMULATED data)", () => {
  it("is deterministic for a seed", () => {
    expect(generateSyntheticShifts({ seed: 1, days: 60 })).toEqual(generateSyntheticShifts({ seed: 1, days: 60 }));
    expect(generateSyntheticShifts({ seed: 1, days: 60 })).not.toEqual(generateSyntheticShifts({ seed: 2, days: 60 }));
  });

  it("produces a realistic schedule: no Mondays, busier weekends, valid amounts", () => {
    const shifts = generateSyntheticShifts({ days: 365 });
    expect(shifts.some((s) => new Date(`${s.date}T00:00:00Z`).getUTCDay() === 1)).toBe(false);
    for (const s of shifts) {
      expect(s.grossCents).toBeGreaterThanOrEqual(0);
      expect(s.tipOutCents).toBeLessThanOrEqual(s.grossCents);
    }
    const avg = (dow: number) => {
      const xs = shifts.filter((s) => s.shiftType === "dinner" && new Date(`${s.date}T00:00:00Z`).getUTCDay() === dow);
      return xs.reduce((a, s) => a + s.grossCents, 0) / xs.length;
    };
    expect(avg(6)).toBeGreaterThan(avg(3)); // Saturday dinner > Wednesday dinner
  });
});
