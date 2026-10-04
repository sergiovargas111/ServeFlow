import { describe, expect, it } from "vitest";
import type { ShiftRecord, ShiftTag, ShiftType } from "@/lib/shifts/types";
import { comparableShifts, compareToForecast, forecastFor, MAX_SAMPLES, percentile } from "./engine";

// Consecutive Fridays in 2026 (Jul 3 to Oct 2). TARGET is the next one, Oct 9.
const FRIDAYS = ["2026-07-03", "2026-07-10", "2026-07-17", "2026-07-24", "2026-07-31", "2026-08-07", "2026-08-14",
  "2026-08-21", "2026-08-28", "2026-09-04", "2026-09-11", "2026-09-18", "2026-09-25", "2026-10-02"];
const TARGET = { date: "2026-10-09", shiftType: "dinner" as const }; // a Friday

function shift(date: string, dollars: number, opts: { type?: ShiftType; tipOut?: number; tags?: ShiftTag[] } = {}): ShiftRecord {
  return {
    date,
    shiftType: opts.type ?? "dinner",
    grossCents: Math.round(dollars * 100),
    tipOutCents: Math.round((opts.tipOut ?? 0) * 100),
    tags: opts.tags ?? [],
  };
}

function fridayDinners(amounts: number[]): ShiftRecord[] {
  return amounts.map((a, i) => shift(FRIDAYS[FRIDAYS.length - 1 - i], a)); // most recent first
}

describe("percentile", () => {
  it("interpolates between values", () => {
    expect(percentile([100, 200, 300, 400], 0.25)).toBe(175);
    expect(percentile([100, 200, 300, 400], 0.5)).toBe(250);
    expect(percentile([100, 200, 300, 400], 0.75)).toBe(325);
  });

  it("returns the only value for a single item", () => {
    expect(percentile([150], 0.25)).toBe(150);
  });

  it("returns min and max at the ends", () => {
    expect(percentile([1, 5, 9], 0)).toBe(1);
    expect(percentile([1, 5, 9], 1)).toBe(9);
  });

  it("throws on empty input or bad p", () => {
    expect(() => percentile([], 0.5)).toThrow();
    expect(() => percentile([1], 1.5)).toThrow();
  });
});

describe("forecastFor: unlocking", () => {
  it("returns no forecast with no data", () => {
    expect(forecastFor([], TARGET)).toMatchObject({ status: "locked", sampleSize: 0, needed: 4 });
  });

  it("returns no forecast with one shift", () => {
    expect(forecastFor(fridayDinners([150]), TARGET)).toMatchObject({ status: "locked", sampleSize: 1, needed: 3 });
  });

  it("returns no forecast under 4 shifts", () => {
    expect(forecastFor(fridayDinners([150, 160, 170]), TARGET).status).toBe("locked");
  });

  it("unlocks at exactly 4 comparable shifts", () => {
    const f = forecastFor(fridayDinners([100, 200, 300, 400]), TARGET);
    expect(f).toMatchObject({ status: "ready", sampleSize: 4, p25: 17500, median: 25000, p75: 32500 });
  });

  it("respects a custom minimum", () => {
    expect(forecastFor(fridayDinners([100, 200]), TARGET, { minSamples: 2 }).status).toBe("ready");
  });
});

describe("forecastFor: like with like", () => {
  it("ignores other days of the week", () => {
    const history = [...fridayDinners([150, 150, 150]), shift("2026-10-01", 900)]; // a Thursday
    expect(forecastFor(history, TARGET).status).toBe("locked");
  });

  it("ignores other shift types on the same day", () => {
    const lunches = FRIDAYS.slice(0, 6).map((d) => shift(d, 60, { type: "lunch" }));
    expect(forecastFor(lunches, TARGET).status).toBe("locked");
    const f = forecastFor([...lunches, ...fridayDinners([150, 160, 170, 180])], TARGET);
    expect(f).toMatchObject({ status: "ready", sampleSize: 4 });
  });

  it("keeps holiday shifts out of normal forecasts", () => {
    const history = [...fridayDinners([150, 150, 150]), shift("2026-07-03", 600, { tags: ["holiday"] })];
    expect(forecastFor(history, TARGET).status).toBe("locked");
  });

  it("compares holidays with holidays of the same type on any weekday", () => {
    const holidays = ["2025-11-27", "2025-12-24", "2025-12-31", "2026-07-04"].map((d) =>
      shift(d, 400, { tags: ["holiday"] }),
    );
    const f = forecastFor([...holidays, ...fridayDinners([150, 150, 150, 150])], { ...TARGET, holiday: true });
    expect(f).toMatchObject({ status: "ready", holiday: true, sampleSize: 4, median: 40000 });
  });

  it("never uses the target day or later (no peeking)", () => {
    const history = [...fridayDinners([150, 150, 150]), shift("2026-10-09", 999), shift("2026-10-16", 999)];
    expect(forecastFor(history, TARGET).status).toBe("locked");
  });

  it("forecasts take-home (after tip-out), not gross", () => {
    const history = FRIDAYS.slice(-4).map((d) => shift(d, 200, { tipOut: 20 }));
    expect(forecastFor(history, TARGET)).toMatchObject({ median: 18000 });
  });
});

describe("forecastFor: robustness", () => {
  it("uses only the most recent matching shifts", () => {
    // 14 Fridays: the oldest 10 were $100, the latest 4 were $300.
    const history = FRIDAYS.map((d, i) => shift(d, i < 10 ? 100 : 300));
    const f = forecastFor(history, TARGET, { maxSamples: 4 });
    expect(f).toMatchObject({ status: "ready", sampleSize: 4, median: 30000 });
    expect(forecastFor(history, TARGET).sampleSize).toBe(Math.min(MAX_SAMPLES, FRIDAYS.length));
  });

  it("barely moves the typical range for one huge outlier", () => {
    const normal = fridayDinners([140, 150, 155, 160, 165, 170, 175]);
    const withOutlier = [...normal, shift("2026-07-03", 2000)];
    const before = forecastFor(normal, TARGET);
    const after = forecastFor(withOutlier, TARGET);
    if (before.status !== "ready" || after.status !== "ready") throw new Error("expected forecasts");
    expect(Math.abs(after.median - before.median)).toBeLessThanOrEqual(500); // within $5
    expect(after.p75).toBeLessThan(20000);
  });

  it("handles a run of zero-tip nights", () => {
    expect(forecastFor(fridayDinners([0, 0, 0, 0]), TARGET)).toMatchObject({ status: "ready", p25: 0, median: 0, p75: 0 });
  });

  it("does not care about input order", () => {
    const shifts = fridayDinners([120, 180, 150, 210, 90]);
    expect(forecastFor([...shifts].reverse(), TARGET)).toEqual(forecastFor(shifts, TARGET));
  });

  it("returns whole cents", () => {
    const f = forecastFor(fridayDinners([100.01, 100.02, 100.04, 100.07]), TARGET);
    if (f.status !== "ready") throw new Error("expected forecast");
    for (const v of [f.p25, f.median, f.p75]) expect(Number.isInteger(v)).toBe(true);
  });
});

describe("comparableShifts", () => {
  it("returns matches most recent first", () => {
    const dates = comparableShifts(fridayDinners([1, 2, 3]).reverse(), TARGET).map((s) => s.date);
    expect(dates).toEqual(["2026-10-02", "2026-09-25", "2026-09-18"]);
  });
});

describe("compareToForecast", () => {
  const forecast = { status: "ready", dayOfWeek: 5, shiftType: "dinner", holiday: false, sampleSize: 8, p25: 15000, median: 18000, p75: 21000 } as const;

  it("computes % vs the typical midpoint", () => {
    expect(compareToForecast(20628, forecast).pctVsMedian).toBeCloseTo(14.6, 1);
    expect(compareToForecast(9000, forecast).pctVsMedian).toBe(-50);
  });

  it("places the amount relative to the typical range", () => {
    expect(compareToForecast(25000, forecast).position).toBe("above");
    expect(compareToForecast(18000, forecast).position).toBe("within");
    expect(compareToForecast(15000, forecast).position).toBe("within");
    expect(compareToForecast(21000, forecast).position).toBe("within");
    expect(compareToForecast(10000, forecast).position).toBe("below");
  });

  it("returns null % when the typical midpoint is zero", () => {
    expect(compareToForecast(5000, { ...forecast, p25: 0, median: 0, p75: 0 }).pctVsMedian).toBeNull();
  });
});
