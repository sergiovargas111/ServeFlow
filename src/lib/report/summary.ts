import { compareToForecast, forecastFor, isHoliday, type Forecast } from "@/lib/forecast/engine";
import { comparisonMessage, lockedMessage, rangeText, shiftLabel, type ForecastMessage } from "@/lib/forecast/messages";
import { addDays, dayOfWeek } from "@/lib/shifts/dates";
import { takeHomeCents, type ShiftRecord, type ShiftType } from "@/lib/shifts/types";
import { averagePerShift, monthlyTotals, projectedMonthly, weeklyTotals, type Bucket, type Projection } from "./trends";

export interface LatestShift {
  shift: ShiftRecord;
  takeHomeCents: number;
  forecast: Forecast;
  message: ForecastMessage;
}

export interface TypicalShift {
  key: string;
  shiftType: ShiftType;
  label: string;
  range: string;
  sampleSize: number;
  /** Next date this kind of shift falls on, today or later. */
  nextDate: string;
}

export interface TipReport {
  shiftCount: number;
  latest: LatestShift | null;
  averagePerShiftCents: number | null;
  projection: Projection | null;
  weekly: Bucket[];
  monthly: Bucket[];
  typical: TypicalShift[];
}

function latestShift(shifts: readonly ShiftRecord[], today: string): LatestShift | null {
  const past = shifts.filter((s) => s.date <= today);
  if (past.length === 0) return null;
  const shift = past.reduce((a, b) => (b.date > a.date ? b : a));
  const forecast = forecastFor(shifts, { date: shift.date, shiftType: shift.shiftType, holiday: isHoliday(shift) });
  const takeHome = takeHomeCents(shift);
  const message =
    forecast.status === "ready" ? comparisonMessage(compareToForecast(takeHome, forecast), forecast) : lockedMessage(forecast);
  return { shift, takeHomeCents: takeHome, forecast, message };
}

/** Unlocked typical ranges for each weekday + shift type the user works, soonest first. */
function typicalShifts(shifts: readonly ShiftRecord[], today: string, limit: number): TypicalShift[] {
  const groups = new Map<string, { dow: number; type: ShiftType }>();
  for (const s of shifts) {
    if (isHoliday(s) || s.date > today) continue;
    const dow = dayOfWeek(s.date);
    groups.set(`${dow}-${s.shiftType}`, { dow, type: s.shiftType });
  }

  const todayDow = dayOfWeek(today);
  const typeOrder: Record<ShiftType, number> = { lunch: 0, double: 1, dinner: 2 };
  const out: TypicalShift[] = [];
  for (const [key, { dow, type }] of groups) {
    // Forecast for the next occurrence after today so every past shift counts.
    const ahead = (dow - todayDow + 7) % 7 || 7;
    const forecast = forecastFor(shifts.filter((s) => s.date <= today), { date: addDays(today, ahead), shiftType: type });
    if (forecast.status !== "ready") continue;
    out.push({
      key,
      shiftType: type,
      label: shiftLabel(forecast),
      range: rangeText(forecast),
      sampleSize: forecast.sampleSize,
      nextDate: addDays(today, ahead % 7),
    });
  }
  return out
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate) || typeOrder[a.shiftType] - typeOrder[b.shiftType])
    .slice(0, limit);
}

export function buildTipReport(shifts: readonly ShiftRecord[], today: string, { typicalLimit = 7 } = {}): TipReport {
  const past = shifts.filter((s) => s.date <= today);
  return {
    shiftCount: past.length,
    latest: latestShift(shifts, today),
    averagePerShiftCents: averagePerShift(past),
    projection: projectedMonthly(shifts, today),
    weekly: weeklyTotals(shifts, today),
    monthly: monthlyTotals(shifts, today),
    typical: typicalShifts(shifts, today, typicalLimit),
  };
}
