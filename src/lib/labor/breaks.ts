// Break log options. Must match the break_logs CHECK constraints in supabase/migrations.

export const BREAK_TYPES = ["meal", "rest"] as const;
export const BREAK_OUTCOMES = ["taken", "short", "interrupted", "missed"] as const;
export const BREAK_PAID = ["paid", "unpaid", "unsure"] as const;

export const BREAK_TYPE_LABELS: Record<(typeof BREAK_TYPES)[number], string> = { meal: "Meal break", rest: "Rest break" };
export const BREAK_OUTCOME_LABELS: Record<(typeof BREAK_OUTCOMES)[number], string> = {
  taken: "Taken in full",
  short: "Cut short",
  interrupted: "Interrupted",
  missed: "Didn't get one",
};
export const BREAK_PAID_LABELS: Record<(typeof BREAK_PAID)[number], string> = { paid: "Paid", unpaid: "Unpaid", unsure: "Not sure" };
