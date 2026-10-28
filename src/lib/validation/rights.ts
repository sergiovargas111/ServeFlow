import { z } from "zod";
import { BREAK_OUTCOMES, BREAK_PAID, BREAK_TYPES } from "@/lib/labor/breaks";
import { addDays, isValidIsoDate } from "@/lib/shifts/dates";
import { RULE_STATUSES, US_STATES } from "@/lib/labor/types";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** A US state/DC code, or blank to clear it. */
export const stateSchema = z.object({
  state: z.preprocess(
    blankToUndefined,
    z
      .string()
      .transform((s) => s.trim().toUpperCase())
      .refine((s) => s in US_STATES, { error: "Pick a US state." })
      .optional(),
  ),
});

export function makeBreakLogSchema(today: string) {
  return z.object({
    shiftDate: z
      .string({ error: "Pick a date." })
      .refine(isValidIsoDate, { error: "Pick a valid date." })
      .refine((d) => d >= "2000-01-01" && d <= addDays(today, 1), { error: "Pick a date that isn't in the future." }),
    breakType: z.enum(BREAK_TYPES, { error: "Pick meal or rest break." }),
    outcome: z.enum(BREAK_OUTCOMES, { error: "Pick what happened." }),
    minutes: z.preprocess(
      blankToUndefined,
      z
        .string()
        .regex(/^\d{1,3}$/, { error: "Enter whole minutes." })
        .transform(Number)
        .refine((m) => m <= 120, { error: "At most 120 minutes." })
        .optional(),
    ),
    paid: z.enum(BREAK_PAID, { error: "Pick paid, unpaid or not sure." }).default("unsure"),
    notes: z.preprocess(
      blankToUndefined,
      z
        .string()
        .transform((s) => s.replaceAll("\u0000", "").trim())
        .refine((s) => s.length <= 500, { error: "Notes are limited to 500 characters." })
        .optional(),
    ),
  });
}

export const adminRuleUpdateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify"), id: z.string().regex(/^[a-z]{2}-[a-z_]+$/) }),
  z.object({ action: z.literal("status"), id: z.string().regex(/^[a-z]{2}-[a-z_]+$/), status: z.enum(RULE_STATUSES) }),
]);
