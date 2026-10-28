import { forecastFor, isHoliday, percentile } from "@/lib/forecast/engine";
import { addDays, dayOfWeek, startOfWeek } from "@/lib/shifts/dates";
import { takeHomeCents, type ShiftRecord, type ShiftType } from "@/lib/shifts/types";
import { splitCents } from "./split";
import type { Split } from "./types";

/**
 * Week-ahead budgeting built on the tip forecast. Everything is "based on your
 * history", and below-typical results are reported neutrally.
 *
 * - Usual schedule: the weekday + shift type combos the user worked in at
 *   least half of their recent weeks.
 * - Typical week: the sum of those slots' typical (median) take-home.
 * - This week: what's been earned so far plus the typical amount for the usual
 *   shifts still ahead.
 * - Safe to spend: the spending share of a conservative week, where the shifts
 *   still ahead count at 80% of typical.
 */

export const CONSERVATIVE_FACTOR = 0.8;
/** A week projecting under 85% of typical gets a heads-up. */
export const SLOW_WEEK_RATIO = 0.85;

export interface Slot {
  dayOfWeek: number;
  shiftType: ShiftType;
}

const pastOnly = (shifts: readonly ShiftRecord[], today: string) => shifts.filter((s) => s.date <= today);

/**
 * Weekday + shift type combos worked in at least `minShare` of the last
 * `weeks` complete weeks (counting only weeks since the first logged shift).
 * Needs at least 2 such weeks; holidays don't define a schedule.
 */
export function usualSlots(shifts: readonly ShiftRecord[], today: string, { weeks = 8, minShare = 0.5 } = {}): Slot[] {
  const past = pastOnly(shifts, today).filter((s) => !isHoliday(s));
  if (past.length === 0) return [];
  const thisWeek = startOfWeek(today);
  const firstWeek = startOfWeek(past.reduce((min, s) => (s.date < min ? s.date : min), past[0].date));
  const windowStart = addDays(thisWeek, -7 * weeks);
  const start = firstWeek > windowStart ? firstWeek : windowStart;
  const weekCount = Math.round((Date.parse(thisWeek) - Date.parse(start)) / (7 * 86_400_000));
  if (weekCount < 2) return [];

  const weeksBySlot = new Map<string, Set<string>>();
  for (const s of past) {
    if (s.date < start || s.date >= thisWeek) continue;
    const key = `${dayOfWeek(s.date)}-${s.shiftType}`;
    if (!weeksBySlot.has(key)) weeksBySlot.set(key, new Set());
    weeksBySlot.get(key)!.add(startOfWeek(s.date));
  }

  const slots: Slot[] = [];
  for (const [key, ws] of weeksBySlot) {
    if (ws.size / weekCount < minShare) continue;
    const [dow, type] = key.split("-");
    slots.push({ dayOfWeek: Number(dow), shiftType: type as ShiftType });
  }
  return slots.sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7) || a.shiftType.localeCompare(b.shiftType));
}

/** Date of a weekday within the Monday-start week beginning at weekStart. */
function dateInWeek(weekStart: string, dow: number): string {
  return addDays(weekStart, (dow + 6) % 7);
}

export interface WeekOutlook {
  weekStart: string;
  earnedCents: number;
  /** Typical take-home for the usual shifts still ahead this week. */
  expectedRemainingCents: number;
  remainingShifts: number;
  projectedCents: number;
  /** Earned so far + the p25 / p75 of the shifts still ahead: the week's typical range. */
  projectedLowCents: number;
  projectedHighCents: number;
  /** Earned so far + 80% of what's typical for the shifts ahead. */
  conservativeCents: number;
  /** null until at least one usual shift has an unlocked forecast. */
  typicalWeekCents: number | null;
  slow: boolean;
}

export function weekOutlook(shifts: readonly ShiftRecord[], today: string): WeekOutlook {
  const past = pastOnly(shifts, today);
  const weekStart = startOfWeek(today);
  const thisWeek = past.filter((s) => s.date >= weekStart);
  const earnedCents = thisWeek.reduce((sum, s) => sum + takeHomeCents(s), 0);

  let typical = 0;
  let typicalSlots = 0;
  let expectedRemainingCents = 0;
  let remainingLow = 0;
  let remainingHigh = 0;
  let remainingShifts = 0;
  for (const slot of usualSlots(shifts, today)) {
    const date = dateInWeek(weekStart, slot.dayOfWeek);
    const forecast = forecastFor(past, { date, shiftType: slot.shiftType });
    if (forecast.status !== "ready") continue;
    typical += forecast.median;
    typicalSlots += 1;
    const alreadyLogged = thisWeek.some((s) => s.date === date && s.shiftType === slot.shiftType);
    if (date >= today && !alreadyLogged) {
      expectedRemainingCents += forecast.median;
      remainingLow += forecast.p25;
      remainingHigh += forecast.p75;
      remainingShifts += 1;
    }
  }

  const typicalWeekCents = typicalSlots > 0 ? typical : null;
  const projectedCents = earnedCents + expectedRemainingCents;
  return {
    weekStart,
    earnedCents,
    expectedRemainingCents,
    remainingShifts,
    projectedCents,
    projectedLowCents: earnedCents + remainingLow,
    projectedHighCents: earnedCents + remainingHigh,
    conservativeCents: earnedCents + Math.round(expectedRemainingCents * CONSERVATIVE_FACTOR),
    typicalWeekCents,
    slow: typicalWeekCents !== null && typicalWeekCents > 0 && projectedCents < typicalWeekCents * SLOW_WEEK_RATIO,
  };
}

/** The spending share of the conservative week. */
export function safeToSpendCents(outlook: WeekOutlook, split: Split): number {
  return splitCents(outlook.conservativeCents, split).spending;
}

export interface SeasonalSlowWeek {
  weekStart: string;
  /** How far below the surrounding weeks the same week was last year, in whole %. */
  pctBelow: number;
}

/**
 * Upcoming weeks that were slow the same time last year: the matching week
 * (52 weeks back, same weekdays) took home under 85% of the median of the 4
 * weeks either side of it. Weeks with no shifts last year (time off) are
 * skipped, and at least 4 comparison weeks are needed.
 */
export function seasonalSlowWeeks(
  shifts: readonly ShiftRecord[],
  today: string,
  { weeksAhead = 4 } = {},
): SeasonalSlowWeek[] {
  const past = pastOnly(shifts, today);
  const totals = new Map<string, { cents: number; count: number }>();
  for (const s of past) {
    const w = startOfWeek(s.date);
    const t = totals.get(w) ?? { cents: 0, count: 0 };
    t.cents += takeHomeCents(s);
    t.count += 1;
    totals.set(w, t);
  }

  const out: SeasonalSlowWeek[] = [];
  const thisWeek = startOfWeek(today);
  for (let i = 1; i <= weeksAhead; i++) {
    const weekStart = addDays(thisWeek, 7 * i);
    const lastYear = addDays(weekStart, -364);
    const target = totals.get(lastYear);
    if (!target) continue;

    const neighbors: number[] = [];
    for (let k = -4; k <= 4; k++) {
      if (k === 0) continue;
      const n = totals.get(addDays(lastYear, 7 * k));
      if (n) neighbors.push(n.cents);
    }
    if (neighbors.length < 4) continue;

    const baseline = percentile(neighbors.sort((a, b) => a - b), 0.5);
    if (baseline > 0 && target.cents < baseline * SLOW_WEEK_RATIO) {
      out.push({ weekStart, pctBelow: Math.round((1 - target.cents / baseline) * 100) });
    }
  }
  return out;
}
