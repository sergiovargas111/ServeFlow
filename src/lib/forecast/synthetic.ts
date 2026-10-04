import { addDays, dayOfWeek } from "@/lib/shifts/dates";
import type { ShiftRecord, ShiftTag, ShiftType } from "@/lib/shifts/types";

/**
 * SIMULATED data for backtesting the forecast. Not real user data.
 *
 * One server's schedule over `days` days with realistic structure:
 * weekday effects (weekends busier), a summer + December season, a slow
 * upward trend, log-normal night-to-night noise, context tags that move tips
 * (rain, slow section, events), fixed-date holidays, and a ~3% tip-out.
 * Seeded, so the same seed always produces the same dataset.
 */

export interface SyntheticOptions {
  seed?: number;
  start?: string;
  days?: number;
}

// Shift worked on each weekday (Sun..Sat) and how likely they are to work it.
const SCHEDULE: { type: ShiftType; p: number }[][] = [
  [{ type: "double", p: 0.7 }], // Sun
  [], // Mon off
  [{ type: "lunch", p: 0.85 }], // Tue
  [{ type: "dinner", p: 0.85 }], // Wed
  [{ type: "dinner", p: 0.9 }], // Thu
  [{ type: "lunch", p: 0.5 }, { type: "dinner", p: 0.95 }], // Fri
  [{ type: "dinner", p: 0.95 }], // Sat
];

const BASE_DOLLARS: Record<ShiftType, number> = { lunch: 70, dinner: 160, double: 250 };
const DOW_MULT = [1.05, 0.8, 0.8, 0.85, 0.95, 1.25, 1.35];
const HOLIDAYS = ["01-01", "02-14", "05-10", "07-04", "11-26", "12-24", "12-31"];

const TAG_EFFECTS: { tag: ShiftTag; p: number; mult: number }[] = [
  { tag: "rainy", p: 0.1, mult: 0.85 },
  { tag: "slow_section", p: 0.08, mult: 0.8 },
  { tag: "short_staffed", p: 0.07, mult: 1.1 },
  { tag: "event_nearby", p: 0.05, mult: 1.25 },
];

/** mulberry32: tiny, fast, seedable PRNG. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seasonMult(iso: string): number {
  const [, m, d] = iso.split("-").map(Number);
  const dayOfYear = (m - 1) * 30.4 + d;
  const summer = 0.1 * Math.sin((2 * Math.PI * (dayOfYear - 80)) / 365);
  const december = m === 12 ? 0.1 : 0;
  return 1 + summer + december;
}

export function generateSyntheticShifts({ seed = 42, start = "2024-10-01", days = 730 }: SyntheticOptions = {}): ShiftRecord[] {
  const rand = prng(seed);
  const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand()); // Box-Muller
  const shifts: ShiftRecord[] = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const dow = dayOfWeek(date);
    const holiday = HOLIDAYS.includes(date.slice(5));

    for (const { type, p } of SCHEDULE[dow]) {
      if (rand() > (holiday ? 0.9 : p)) continue;

      const tags: ShiftTag[] = holiday ? ["holiday"] : [];
      let mult = DOW_MULT[dow] * seasonMult(date) * (1 + 0.05 * (i / 365)) * (holiday ? 1.4 : 1);
      for (const effect of TAG_EFFECTS) {
        if (rand() < effect.p) {
          tags.push(effect.tag);
          mult *= effect.mult;
        }
      }
      const dollars = BASE_DOLLARS[type] * mult * Math.exp(0.22 * normal());
      const grossCents = Math.max(0, Math.round(dollars * 100));
      shifts.push({ date, shiftType: type, grossCents, tipOutCents: Math.round(grossCents * 0.03), tags });
    }
  }
  return shifts;
}
