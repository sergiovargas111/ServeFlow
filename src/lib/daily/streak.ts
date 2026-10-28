import { addDays } from "@/lib/shifts/dates";

/**
 * Streaks count days with any activity: a logged shift (any amount; a slow
 * night counts the same as a great one), a drill, or a daily habit checked
 * off. Today not being done yet never breaks the streak; it's still alive
 * through yesterday.
 */

export interface Streak {
  current: number;
  best: number;
  activeToday: boolean;
}

export function computeStreak(activeDates: Iterable<string>, today: string): Streak {
  const days = new Set([...activeDates].filter((d) => d <= today));
  const activeToday = days.has(today);

  let current = 0;
  for (let d = activeToday ? today : addDays(today, -1); days.has(d); d = addDays(d, -1)) current++;

  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of [...days].sort()) {
    run = prev !== null && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }

  return { current, best: Math.max(best, current), activeToday };
}
