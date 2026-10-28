import { addDays } from "@/lib/shifts/dates";
import { createClient } from "@/lib/supabase/server";
import { ALLERGENS, type Allergen, type MenuItem } from "./menu-quiz";
import type { Attempt } from "./progress";

// Reads for the signed-in user (RLS limits every query to their own rows).

interface AttemptRow {
  drill_id: string;
  score: number;
  total: number;
  completed_on: string;
}

export function rowToAttempt(r: AttemptRow): Attempt {
  return { drillId: r.drill_id, score: r.score, total: r.total, completedOn: r.completed_on };
}

/** All drill attempts (levels need every pass ever), newest first. */
export async function fetchAttempts(): Promise<Attempt[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("drill_attempts")
    .select("drill_id, score, total, completed_on")
    .order("completed_on", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`Couldn't load drills (${error.code})`);
  return (data ?? []).map(rowToAttempt);
}

interface MenuRow {
  id: string;
  name: string;
  description: string | null;
  allergens: string[] | null;
}

export function rowToMenuItem(r: MenuRow): MenuItem {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    allergens: (r.allergens ?? []).filter((a): a is Allergen => (ALLERGENS as readonly string[]).includes(a)),
  };
}

export async function fetchMenuItems(): Promise<MenuItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("menu_items").select("id, name, description, allergens").order("name").limit(500);
  if (error) throw new Error(`Couldn't load your menu (${error.code})`);
  return (data ?? []).map(rowToMenuItem);
}

/** Days with a checked-off habit, and which habits, over the last `days` days. */
export async function fetchHabitCompletions(today: string, days = 400): Promise<{ taskId: string; date: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_completions")
    .select("task_id, completed_on")
    .gte("completed_on", addDays(today, -days))
    .limit(5000);
  if (error) throw new Error(`Couldn't load habits (${error.code})`);
  return (data ?? []).map((r) => ({ taskId: r.task_id as string, date: r.completed_on as string }));
}
