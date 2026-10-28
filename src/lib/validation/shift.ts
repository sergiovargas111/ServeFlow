import { z } from "zod";
import { addDays, isValidIsoDate } from "@/lib/shifts/dates";
import { MAX_AMOUNT_CENTS, MAX_SALES_CENTS, parseMoneyToCents } from "@/lib/shifts/money";
import { SHIFT_TAGS, SHIFT_TYPES } from "@/lib/shifts/types";

const EARLIEST_DATE = "2000-01-01";
export const MAX_SHIFT_HOURS = 16;
export const MAX_TABLES = 100;
export const MAX_NOTES_LENGTH = 500;

/** Empty or whitespace-only strings count as "not provided". */
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const money = (label: string, maxCents = MAX_AMOUNT_CENTS) =>
  z
    .string({ error: `Enter ${label} as a number.` })
    .transform((v, ctx) => {
      const cents = parseMoneyToCents(v, maxCents);
      if (cents === null) {
        const max = (maxCents / 100).toLocaleString("en-US");
        ctx.addIssue({ code: "custom", message: `Enter ${label} like 85 or 85.50 (up to $${max}).` });
        return z.NEVER;
      }
      return cents;
    });

const optionalMoney = (label: string, maxCents?: number) =>
  z.preprocess(blankToUndefined, money(label, maxCents).optional());

/**
 * Validates a shift submitted from the log form or the offline queue.
 * `today` is passed in (server date) so tests are deterministic. Dates up to
 * one day ahead are allowed because the server's day may lag the user's.
 */
export function makeShiftSchema(today: string) {
  const latest = addDays(today, 1);

  return z
    .object({
      shiftDate: z
        .string({ error: "Pick a date." })
        .refine(isValidIsoDate, { error: "Pick a valid date." })
        .refine((d) => d >= EARLIEST_DATE, { error: "That date is too far in the past." })
        .refine((d) => d <= latest, { error: "That date is in the future." }),
      shiftType: z.enum(SHIFT_TYPES, { error: "Pick lunch, dinner or double." }),
      grossTips: money("your total tips"),
      cashTips: optionalMoney("cash tips"),
      cardTips: optionalMoney("card tips"),
      tipOut: optionalMoney("tip-out"),
      sales: optionalMoney("sales", MAX_SALES_CENTS),
      hours: z.preprocess(
        blankToUndefined,
        z
          .string()
          .regex(/^\d{1,2}(\.\d{1,2})?$/, { error: "Enter hours like 6 or 6.5." })
          .transform(Number)
          .refine((h) => h > 0 && h <= MAX_SHIFT_HOURS, { error: `Hours must be between 0 and ${MAX_SHIFT_HOURS}.` })
          .optional(),
      ),
      tables: z.preprocess(
        blankToUndefined,
        z
          .string()
          .regex(/^\d{1,3}$/, { error: "Enter a whole number of tables." })
          .transform(Number)
          .refine((t) => t <= MAX_TABLES, { error: `At most ${MAX_TABLES} tables.` })
          .optional(),
      ),
      tags: z
        .array(z.enum(SHIFT_TAGS, { error: "Unknown tag." }))
        .max(SHIFT_TAGS.length)
        .refine((tags) => new Set(tags).size === tags.length, { error: "Duplicate tag." })
        .default([]),
      notes: z.preprocess(
        blankToUndefined,
        z
          .string()
          // Postgres text can't hold NUL bytes; drop them instead of erroring.
          .transform((s) => s.replaceAll("\u0000", "").trim())
          .refine((s) => s.length <= MAX_NOTES_LENGTH, { error: `Notes are limited to ${MAX_NOTES_LENGTH} characters.` })
          .optional(),
      ),
      clientId: z.preprocess(blankToUndefined, z.uuid({ error: "Invalid client id." }).optional()),
    })
    .superRefine((shift, ctx) => {
      if (shift.tipOut !== undefined && shift.tipOut > shift.grossTips) {
        ctx.addIssue({ code: "custom", path: ["tipOut"], message: "Tip-out can't be more than your total tips." });
      }
      if (
        shift.cashTips !== undefined &&
        shift.cardTips !== undefined &&
        shift.cashTips + shift.cardTips !== shift.grossTips
      ) {
        ctx.addIssue({ code: "custom", path: ["cashTips"], message: "Cash + card should add up to your total." });
      }
      if ((shift.cashTips ?? 0) > shift.grossTips || (shift.cardTips ?? 0) > shift.grossTips) {
        ctx.addIssue({ code: "custom", path: ["cashTips"], message: "Cash or card can't be more than your total." });
      }
    });
}

export type ShiftInput = z.input<ReturnType<typeof makeShiftSchema>>;
export type ValidShift = z.output<ReturnType<typeof makeShiftSchema>>;
