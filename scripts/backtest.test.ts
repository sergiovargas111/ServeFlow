import { describe, expect, it } from "vitest";
import { runBacktest, type BacktestGroup } from "@/lib/forecast/backtest";
import { generateSyntheticShifts } from "@/lib/forecast/synthetic";
import { formatCents } from "@/lib/shifts/money";

/**
 * Forecast backtest on SIMULATED data (seeded, 2 years, one server).
 * `npm run backtest` prints the report; `npm test` also runs it as a
 * regression guard so a change that breaks calibration fails CI.
 * Copy the printed numbers into docs/METRICS.md when they change.
 */

const SEEDS = [42, 7, 2026];

function row(label: string, g: BacktestGroup) {
  return `${label.padEnd(10)} ${String(g.forecasts).padStart(5)}  ${`${g.inRangePct}%`.padStart(6)}  ${formatCents(g.maeCents).padStart(6)}  ${`${g.medianApePct}%`.padStart(6)}`;
}

describe("forecast backtest (SIMULATED data)", () => {
  const results = SEEDS.map((seed) => ({ seed, result: runBacktest(generateSyntheticShifts({ seed })) }));

  it("prints the report", () => {
    for (const { seed, result: r } of results) {
      const lines = [
        `\nSIMULATED dataset, seed ${seed}: ${r.shifts} shifts, ${r.locked} before unlock, ${r.forecasts} forecast`,
        `in typical range (p25-p75): ${r.inRangePct}%  | above: ${r.aboveRangePct}%  | below: ${r.belowRangePct}%`,
        `group      count  inRange    MAE   medAPE`,
        row("overall", r),
        ...Object.entries(r.byShiftType).map(([k, g]) => row(k, g!)),
        ...Object.entries(r.bySampleSize).map(([k, g]) => row(`n=${k}`, g)),
      ];
      console.log(lines.join("\n"));
    }
  });

  it.each(SEEDS)("keeps the p25-p75 range roughly calibrated (seed %i)", (seed) => {
    const r = results.find((x) => x.seed === seed)!.result;
    // An interquartile range should hold about half of outcomes.
    expect(r.inRangePct).toBeGreaterThan(35);
    expect(r.inRangePct).toBeLessThan(65);
    // Misses should not lean heavily to one side (no systematic bias).
    expect(Math.abs(r.aboveRangePct - r.belowRangePct)).toBeLessThan(15);
  });
});
