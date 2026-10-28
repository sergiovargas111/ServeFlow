import { createClient } from "@/lib/supabase/server";
import { BUDGET_COLUMNS, rowToSettings, type BudgetRow } from "./rows";
import type { BudgetSettings } from "./types";

/** The signed-in user's budget settings (RLS limits it to their own row), or the defaults. */
export async function fetchBudgetSettings(): Promise<BudgetSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("budget_settings").select(BUDGET_COLUMNS).maybeSingle();
  if (error) throw new Error(`Couldn't load budget settings (${error.code})`);
  return rowToSettings(data as BudgetRow | null);
}
