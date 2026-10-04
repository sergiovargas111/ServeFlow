import { addDays, daysBetween, monthKey, startOfWeek } from "@/lib/shifts/dates";
import { takeHomeCents, type ShiftRecord } from "@/lib/shifts/types";

// Trend math for the Tip Report. All amounts are take-home cents.

export interface Bucket {
  key: string;
  label: string;
  totalCents: number;
  shifts: number;
}

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function utcDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

function bucketize(shifts: readonly ShiftRecord[], keys: string[], keyOf: (date: string) => string, label: (key: string) => string) {
  const buckets = new Map<string, Bucket>(keys.map((k) => [k, { key: k, label: label(k), totalCents: 0, shifts: 0 }]));
  for (const s of shifts) {
    const b = buckets.get(keyOf(s.date));
    if (!b) continue;
    b.totalCents += takeHomeCents(s);
    b.shifts += 1;
  }
  return keys.map((k) => buckets.get(k)!);
}

/** Take-home per week (Monday start) for the last `weeks` weeks including this one, oldest first. Empty weeks are 0. */
export function weeklyTotals(shifts: readonly ShiftRecord[], today: string, weeks = 8): Bucket[] {
  const thisWeek = startOfWeek(today);
  const keys = Array.from({ length: weeks }, (_, i) => addDays(thisWeek, -7 * (weeks - 1 - i)));
  const inRange = shifts.filter((s) => s.date <= today);
  return bucketize(inRange, keys, startOfWeek, (k) => dayFmt.format(utcDate(k)));
}

/** Take-home per calendar month for the last `months` months including this one, oldest first. */
export function monthlyTotals(shifts: readonly ShiftRecord[], today: string, months = 6): Bucket[] {
  const [y, m] = today.split("-").map(Number);
  const keys = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (months - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
  const inRange = shifts.filter((s) => s.date <= today);
  return bucketize(inRange, keys, monthKey, (k) => monthFmt.format(utcDate(`${k}-01`)));
}

export function averagePerShift(shifts: readonly ShiftRecord[]): number | null {
  if (shifts.length === 0) return null;
  return Math.round(shifts.reduce((sum, s) => sum + takeHomeCents(s), 0) / shifts.length);
}

export interface Projection {
  monthlyCents: number;
  /** How many days of history the projection is based on. */
  basisDays: number;
}

const DAYS_PER_MONTH = 365.25 / 12;

/**
 * Typical monthly take-home based on the recent daily average:
 * (take-home over the last `windowDays`, or since the first shift if newer) / days × days per month.
 * Returns null until there are `minDays` of history, so a first good weekend isn't extrapolated.
 */
export function projectedMonthly(
  shifts: readonly ShiftRecord[],
  today: string,
  { windowDays = 56, minDays = 14 } = {},
): Projection | null {
  const past = shifts.filter((s) => s.date <= today);
  if (past.length === 0) return null;
  const first = past.reduce((min, s) => (s.date < min ? s.date : min), past[0].date);
  const windowStart = addDays(today, -(windowDays - 1));
  const start = first > windowStart ? first : windowStart;
  const basisDays = daysBetween(start, today) + 1;
  if (basisDays < minDays) return null;

  const total = past.filter((s) => s.date >= start).reduce((sum, s) => sum + takeHomeCents(s), 0);
  return { monthlyCents: Math.round((total / basisDays) * DAYS_PER_MONTH), basisDays };
}
