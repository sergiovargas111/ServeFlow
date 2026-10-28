import type { ValidShift } from "@/lib/validation/shift";
import { centsToDollars, dollarsToCents } from "./money";
import { SHIFT_TAGS, SHIFT_TYPES, type ShiftRecord, type ShiftTag, type ShiftType } from "./types";

// Mapping between validated input, database rows and the ShiftRecord the
// forecast/report code works with.

/** Columns the report and forecast need; keep selects narrow. */
export const SHIFT_RECORD_COLUMNS = "shift_date, shift_type, gross_tips, tip_out, tags";

export interface ShiftRow {
  shift_date: string;
  shift_type: string;
  gross_tips: number | string;
  tip_out: number | string | null;
  tags: string[] | null;
}

export function rowToRecord(row: ShiftRow): ShiftRecord | null {
  if (!(SHIFT_TYPES as readonly string[]).includes(row.shift_type)) return null;
  return {
    date: row.shift_date,
    shiftType: row.shift_type as ShiftType,
    grossCents: dollarsToCents(row.gross_tips),
    tipOutCents: row.tip_out == null ? 0 : dollarsToCents(row.tip_out),
    tags: (row.tags ?? []).filter((t): t is ShiftTag => (SHIFT_TAGS as readonly string[]).includes(t)),
  };
}

export function rowsToRecords(rows: readonly ShiftRow[]): ShiftRecord[] {
  return rows.map(rowToRecord).filter((r): r is ShiftRecord => r !== null);
}

/** Insert payload. user_id always comes from the verified session, never from input. */
export function toInsertRow(shift: ValidShift, userId: string) {
  return {
    user_id: userId,
    shift_date: shift.shiftDate,
    shift_type: shift.shiftType,
    gross_tips: centsToDollars(shift.grossTips),
    cash_tips: shift.cashTips === undefined ? null : centsToDollars(shift.cashTips),
    card_tips: shift.cardTips === undefined ? null : centsToDollars(shift.cardTips),
    tip_out: centsToDollars(shift.tipOut ?? 0),
    sales: shift.sales === undefined ? null : centsToDollars(shift.sales),
    hours: shift.hours ?? null,
    tables_count: shift.tables ?? null,
    tags: shift.tags,
    notes: shift.notes ?? null,
    client_id: shift.clientId ?? null,
  };
}
