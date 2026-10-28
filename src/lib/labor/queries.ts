import { createClient } from "@/lib/supabase/server";
import { LABOR_RULE_COLUMNS, rowsToRules, type LaborRuleRow } from "./rows";
import type { LaborRule } from "./types";

/** Rules the signed-in user can see (RLS: published and needs_review; admins also see drafts). */
export async function fetchLaborRules(): Promise<LaborRule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("labor_rules").select(LABOR_RULE_COLUMNS).order("id").limit(1000);
  if (error) throw new Error(`Couldn't load labor rules (${error.code})`);
  return rowsToRules((data ?? []) as LaborRuleRow[]);
}

export async function fetchProfileState(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("state").eq("id", userId).maybeSingle();
  return (data?.state as string | null) ?? null;
}

export interface BreakLog {
  id: string;
  shiftDate: string;
  breakType: "meal" | "rest";
  outcome: "taken" | "short" | "interrupted" | "missed";
  minutes: number | null;
  paid: "paid" | "unpaid" | "unsure";
  notes: string | null;
}

export async function fetchBreakLogs(): Promise<BreakLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("break_logs")
    .select("id, shift_date, break_type, outcome, minutes, paid, notes")
    .order("shift_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Couldn't load break log (${error.code})`);
  return (data ?? []).map((r) => ({
    id: r.id,
    shiftDate: r.shift_date,
    breakType: r.break_type,
    outcome: r.outcome,
    minutes: r.minutes,
    paid: r.paid,
    notes: r.notes,
  }));
}
