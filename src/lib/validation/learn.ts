import { z } from "zod";
import { HABIT_IDS } from "@/lib/daily/tasks";
import { ALLERGENS } from "@/lib/learn/menu-quiz";
import { isValidIsoDate } from "@/lib/shifts/dates";

// Server-side validation for drills, daily habits and menu items.

const isoDate = z.string({ error: "Pick a date." }).refine(isValidIsoDate, { error: "Pick a valid date." });

/** Postgres text can't hold NUL bytes, and control characters have no place in a dish name. */
const cleanText = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

export const drillSubmissionSchema = z.object({
  drillId: z.string().regex(/^(l[1-9]-[a-z-]{1,40}|menu)$/, { error: "Unknown drill." }),
  answers: z.array(z.number().int().min(0).max(9)).max(50),
  /** The phone's calendar day; checked against the server day in the action. */
  completedOn: isoDate,
  /** Menu quizzes only: which shuffle the client was shown. */
  seed: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/).optional(),
});

export const habitSchema = z.object({
  habitId: z.enum(HABIT_IDS as [string, ...string[]], { error: "Unknown habit." }),
  date: isoDate,
  done: z.boolean(),
});

export const MAX_MENU_ITEMS = 150;

export const menuItemSchema = z.object({
  name: z
    .string({ error: "Enter the dish name." })
    .transform(cleanText)
    .refine((s) => s.length >= 1, { error: "Enter the dish name." })
    .refine((s) => s.length <= 80, { error: "Dish names are limited to 80 characters." }),
  description: z
    .string()
    .default("")
    .transform(cleanText)
    .refine((s) => s.length <= 200, { error: "Keep the description under 200 characters." }),
  allergens: z
    .array(z.enum(ALLERGENS, { error: "Unknown allergen." }))
    .max(ALLERGENS.length)
    .refine((a) => new Set(a).size === a.length, { error: "Duplicate allergen." })
    .default([]),
});

export type ValidMenuItem = z.output<typeof menuItemSchema>;
