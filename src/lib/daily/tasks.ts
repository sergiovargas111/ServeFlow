import type { Drill } from "@/lib/learn/content";
import { dayOfYear } from "./dates";

/** Habits the user checks off by hand. Must match task_completions_task_id in supabase/migrations. */
export const HABITS = [
  { id: "memorize_menu", title: "Memorize 3 menu items", detail: "Ingredients, allergens and one line to sell each." },
  { id: "practice_greeting", title: "Practice your greeting", detail: "Say it out loud once: name, a drink suggestion, a special." },
  { id: "review_specials", title: "Review today's specials", detail: "Know what's in them and what they pair with." },
  { id: "learn_pairing", title: "Learn one pairing", detail: "A drink or side that goes with a popular entrée." },
  { id: "plan_section", title: "Plan your section", detail: "Picture your tables and where you'll stash extra silverware." },
] as const;

export type HabitId = (typeof HABITS)[number]["id"];
export const HABIT_IDS = HABITS.map((h) => h.id) as readonly HabitId[];

export type DailyTask =
  | { kind: "log"; title: string; detail: string; done: boolean }
  | { kind: "drill"; title: string; detail: string; done: boolean; drillId: string }
  | { kind: "habit"; title: string; detail: string; done: boolean; habitId: HabitId };

export function habitFor(date: string) {
  return HABITS[dayOfYear(date) % HABITS.length];
}

/** Today's three tasks: log tips, one drill, one rotating habit. */
export function dailyTasks(
  date: string,
  { shiftLogged, drillDone, habitsDone, drill }: { shiftLogged: boolean; drillDone: boolean; habitsDone: ReadonlySet<string>; drill: Drill },
): DailyTask[] {
  const habit = habitFor(date);
  return [
    {
      kind: "log",
      title: "Log tonight's tips",
      detail: "Any night counts, slow ones too. Day off? Skip it; the other tasks keep your streak.",
      done: shiftLogged,
    },
    { kind: "drill", title: `Drill: ${drill.title}`, detail: drill.summary, done: drillDone, drillId: drill.id },
    { kind: "habit", title: habit.title, detail: habit.detail, done: habitsDone.has(habit.id), habitId: habit.id },
  ];
}
