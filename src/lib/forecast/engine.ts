import { dayOfWeek } from "@/lib/shifts/dates";
import { takeHomeCents, type ShiftRecord, type ShiftType } from "@/lib/shifts/types";

/**
 * Tip forecast v1: simple and explainable, no ML.
 *
 * The typical range for a shift is the 25th–75th percentile of what the user
 * took home on comparable past shifts:
 *   - same day of week + same shift type ("Friday dinner")
 *   - holiday shifts are only compared with other holiday shifts of the same
 *     type (any weekday), and normal shifts never with holidays
 *   - only the most recent MAX_SAMPLES matches, so the range follows seasons
 *     and menu/price changes
 *   - no forecast until MIN_SAMPLES matches exist
 */

export const MIN_SAMPLES = 4;
export const MAX_SAMPLES = 16;

export interface ForecastTarget {
  date: string;
  shiftType: ShiftType;
  holiday?: boolean;
}

export interface ForecastOptions {
  minSamples?: number;
  maxSamples?: number;
}

interface ForecastBase {
  dayOfWeek: number;
  shiftType: ShiftType;
  holiday: boolean;
  sampleSize: number;
}

export type Forecast =
  | (ForecastBase & { status: "locked"; needed: number })
  | (ForecastBase & { status: "ready"; p25: number; median: number; p75: number });

/** Linear-interpolated percentile (same as Excel PERCENTILE.INC / R type 7). p in [0, 1]. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new Error("percentile of empty list");
  if (p < 0 || p > 1) throw new Error("p must be between 0 and 1");
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function isHoliday(shift: Pick<ShiftRecord, "tags">): boolean {
  return shift.tags.includes("holiday");
}

/** Past shifts comparable to the target, most recent first. Never includes the target day or later. */
export function comparableShifts(history: readonly ShiftRecord[], target: ForecastTarget): ShiftRecord[] {
  const holiday = target.holiday ?? false;
  const dow = dayOfWeek(target.date);
  return history
    .filter(
      (s) =>
        s.date < target.date &&
        s.shiftType === target.shiftType &&
        isHoliday(s) === holiday &&
        (holiday || dayOfWeek(s.date) === dow),
    )
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function forecastFor(
  history: readonly ShiftRecord[],
  target: ForecastTarget,
  { minSamples = MIN_SAMPLES, maxSamples = MAX_SAMPLES }: ForecastOptions = {},
): Forecast {
  const base = {
    dayOfWeek: dayOfWeek(target.date),
    shiftType: target.shiftType,
    holiday: target.holiday ?? false,
  };
  const recent = comparableShifts(history, target).slice(0, maxSamples);

  if (recent.length < minSamples) {
    return { ...base, status: "locked", sampleSize: recent.length, needed: minSamples - recent.length };
  }

  const values = recent.map(takeHomeCents).sort((a, b) => a - b);
  return {
    ...base,
    status: "ready",
    sampleSize: values.length,
    p25: Math.round(percentile(values, 0.25)),
    median: Math.round(percentile(values, 0.5)),
    p75: Math.round(percentile(values, 0.75)),
  };
}

export type RangePosition = "above" | "within" | "below";

export interface Comparison {
  actual: number;
  /** % difference vs the typical midpoint (median). null when the median is 0. */
  pctVsMedian: number | null;
  position: RangePosition;
}

export function compareToForecast(actualCents: number, forecast: Extract<Forecast, { status: "ready" }>): Comparison {
  const pctVsMedian = forecast.median === 0 ? null : ((actualCents - forecast.median) / forecast.median) * 100;
  const position: RangePosition =
    actualCents > forecast.p75 ? "above" : actualCents < forecast.p25 ? "below" : "within";
  return { actual: actualCents, pctVsMedian, position };
}
