export const SHIFT_TYPES = ["lunch", "dinner", "double"] as const;
export type ShiftType = (typeof SHIFT_TYPES)[number];

export const SHIFT_TYPE_LABELS: Record<ShiftType, string> = {
  lunch: "Lunch",
  dinner: "Dinner",
  double: "Double",
};

/** Context tags. Must match shifts_tags_allowed in supabase/migrations (a test checks this). */
export const SHIFT_TAGS = ["rainy", "slow_section", "holiday", "short_staffed", "event_nearby"] as const;
export type ShiftTag = (typeof SHIFT_TAGS)[number];

export const SHIFT_TAG_LABELS: Record<ShiftTag, string> = {
  rainy: "Rainy",
  slow_section: "Slow section",
  holiday: "Holiday",
  short_staffed: "Short-staffed",
  event_nearby: "Event nearby",
};

/** The minimum the forecast and report need about a shift. Money is in integer cents. */
export interface ShiftRecord {
  /** Calendar date of the shift, YYYY-MM-DD (the server's/user's local day, no time zone). */
  date: string;
  shiftType: ShiftType;
  grossCents: number;
  tipOutCents: number;
  tags: readonly ShiftTag[];
}

/** What the user actually keeps from a shift. */
export function takeHomeCents(shift: Pick<ShiftRecord, "grossCents" | "tipOutCents">): number {
  return Math.max(0, shift.grossCents - shift.tipOutCents);
}
