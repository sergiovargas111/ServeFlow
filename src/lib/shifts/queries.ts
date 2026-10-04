import { addDays } from "@/lib/shifts/dates";
import { createClient } from "@/lib/supabase/server";
import { rowsToRecords, SHIFT_RECORD_COLUMNS, type ShiftRow } from "./rows";
import type { ShiftRecord } from "./types";

/**
 * The signed-in user's recent shifts (RLS limits rows to their own).
 * ~13 months covers the forecast's 16-sample window for weekly shifts plus a
 * year of trend data.
 */
export async function fetchRecentShifts(days = 400): Promise<ShiftRecord[]> {
  const supabase = await createClient();
  const since = addDays(new Date().toISOString().slice(0, 10), -days);
  const { data, error } = await supabase
    .from("shifts")
    .select(SHIFT_RECORD_COLUMNS)
    .gte("shift_date", since)
    .order("shift_date", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`Couldn't load shifts (${error.code})`);
  return rowsToRecords((data ?? []) as ShiftRow[]);
}
