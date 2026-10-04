import { takeHomeCents, type ShiftRecord, type ShiftType } from "@/lib/shifts/types";
import { forecastFor, isHoliday, MAX_SAMPLES, MIN_SAMPLES } from "./engine";

/**
 * Walk-forward backtest: for each shift, forecast it using only shifts from
 * earlier days (the engine never looks at the target day or later), then check
 * whether the real take-home landed inside the typical p25–p75 range.
 *
 * A well-calibrated p25–p75 range should contain about 50% of outcomes.
 */

export interface BacktestGroup {
  forecasts: number;
  inRangePct: number;
  /** Mean absolute error vs the typical midpoint, in cents. */
  maeCents: number;
  /** Median absolute % error vs the midpoint (shifts with a non-zero midpoint). */
  medianApePct: number;
}

export interface BacktestResult extends BacktestGroup {
  shifts: number;
  /** Shifts with no forecast yet (fewer than MIN_SAMPLES comparable shifts). */
  locked: number;
  aboveRangePct: number;
  belowRangePct: number;
  byShiftType: Partial<Record<ShiftType, BacktestGroup>>;
  bySampleSize: Record<string, BacktestGroup>;
}

interface Outcome {
  type: ShiftType;
  sampleSize: number;
  inRange: boolean;
  above: boolean;
  absErr: number;
  ape: number | null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function summarize(outcomes: Outcome[]): BacktestGroup {
  const n = outcomes.length;
  if (n === 0) return { forecasts: 0, inRangePct: 0, maeCents: 0, medianApePct: 0 };
  const round1 = (x: number) => Math.round(x * 10) / 10;
  return {
    forecasts: n,
    inRangePct: round1((outcomes.filter((o) => o.inRange).length / n) * 100),
    maeCents: Math.round(outcomes.reduce((s, o) => s + o.absErr, 0) / n),
    medianApePct: round1(median(outcomes.flatMap((o) => (o.ape === null ? [] : [o.ape])))),
  };
}

export function sampleSizeBucket(n: number): string {
  if (n < 8) return `${MIN_SAMPLES}-7`;
  if (n < 12) return "8-11";
  return `12-${MAX_SAMPLES}`;
}

export function runBacktest(shifts: readonly ShiftRecord[]): BacktestResult {
  const outcomes: Outcome[] = [];
  let locked = 0;

  for (const shift of shifts) {
    const forecast = forecastFor(shifts, { date: shift.date, shiftType: shift.shiftType, holiday: isHoliday(shift) });
    if (forecast.status !== "ready") {
      locked += 1;
      continue;
    }
    const actual = takeHomeCents(shift);
    outcomes.push({
      type: shift.shiftType,
      sampleSize: forecast.sampleSize,
      inRange: actual >= forecast.p25 && actual <= forecast.p75,
      above: actual > forecast.p75,
      absErr: Math.abs(actual - forecast.median),
      ape: forecast.median === 0 ? null : (Math.abs(actual - forecast.median) / forecast.median) * 100,
    });
  }

  const group = <K extends string>(key: (o: Outcome) => K) => {
    const groups: Partial<Record<K, Outcome[]>> = {};
    for (const o of outcomes) (groups[key(o)] ??= []).push(o);
    return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, summarize(v as Outcome[])])) as Record<K, BacktestGroup>;
  };

  const n = outcomes.length || 1;
  return {
    shifts: shifts.length,
    locked,
    ...summarize(outcomes),
    aboveRangePct: Math.round((outcomes.filter((o) => o.above).length / n) * 1000) / 10,
    belowRangePct: Math.round((outcomes.filter((o) => !o.inRange && !o.above).length / n) * 1000) / 10,
    byShiftType: group((o) => o.type),
    bySampleSize: group((o) => sampleSizeBucket(o.sampleSize)),
  };
}
