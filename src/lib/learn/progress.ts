import { dayOfYear } from "@/lib/daily/dates";
import { DRILLS, drillsForLevel, LEVELS, PASS_RATIO, PLAYABLE_LEVELS, type Drill, type LevelId, type Question } from "./content";

export interface Attempt {
  drillId: string;
  score: number;
  total: number;
  /** YYYY-MM-DD */
  completedOn: string;
}

export interface Grade {
  score: number;
  total: number;
  passed: boolean;
  /** Per question: was the answer right? */
  results: boolean[];
}

export function isPassing(score: number, total: number): boolean {
  return total > 0 && score / total >= PASS_RATIO;
}

/**
 * Grades answers against the questions. Answers are choice indexes in
 * question order; anything missing, out of range or not an integer is wrong.
 * Grading always happens on the server, never trusting a client score.
 */
export function grade(questions: readonly Question[], answers: readonly unknown[]): Grade {
  const results = questions.map((q, i) => answers[i] === q.answer);
  const score = results.filter(Boolean).length;
  return { score, total: questions.length, passed: isPassing(score, questions.length), results };
}

export function passedDrillIds(attempts: readonly Attempt[]): Set<string> {
  return new Set(attempts.filter((a) => isPassing(a.score, a.total)).map((a) => a.drillId));
}

export interface LevelProgress {
  id: LevelId;
  title: string;
  summary: string;
  playable: boolean;
  unlocked: boolean;
  passed: number;
  total: number;
  complete: boolean;
}

/**
 * Level 1 is always open. Each later playable level unlocks once every drill
 * in the level before it is passed (80%+). Levels without drills yet are
 * shown as coming later.
 */
export function levelProgress(attempts: readonly Attempt[]): LevelProgress[] {
  const passed = passedDrillIds(attempts);
  let previousComplete = true;
  return LEVELS.map((level) => {
    const drills = drillsForLevel(level.id);
    const playable = PLAYABLE_LEVELS.includes(level.id);
    const done = drills.filter((d) => passed.has(d.id)).length;
    const unlocked = playable && previousComplete;
    const complete = playable && drills.length > 0 && done === drills.length;
    previousComplete = complete;
    return { ...level, playable, unlocked, passed: done, total: drills.length, complete };
  });
}

export function isDrillUnlocked(drill: Drill, attempts: readonly Attempt[]): boolean {
  return levelProgress(attempts).some((l) => l.id === drill.level && l.unlocked);
}

/**
 * Today's suggested drill: the first one not yet passed in an unlocked level,
 * or, once everything is passed, a review drill that rotates by day.
 */
export function suggestedDrill(attempts: readonly Attempt[], today: string): Drill {
  const passed = passedDrillIds(attempts);
  const unlocked = DRILLS.filter((d) => isDrillUnlocked(d, attempts));
  const next = unlocked.find((d) => !passed.has(d.id));
  if (next) return next;
  return unlocked[dayOfYear(today) % unlocked.length];
}
