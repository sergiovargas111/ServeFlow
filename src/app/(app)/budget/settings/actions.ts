"use server";

import { revalidatePath } from "next/cache";
import { settingsToRow } from "@/lib/budget/rows";
import { settingsLimiterByUser } from "@/lib/security/limits";
import { retryMessage } from "@/lib/security/rate-limit";
import { createClient, getUserId } from "@/lib/supabase/server";
import { fieldErrors, pickFormFields } from "@/lib/validation/auth";
import { BUDGET_FORM_FIELDS, budgetSettingsSchema } from "@/lib/validation/budget";

export type BudgetFormState = {
  status: "idle" | "saved" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

/** Saves the signed-in user's tip-out and split settings. Validated here, and again by CHECK constraints. */
export async function saveBudgetSettings(_prev: BudgetFormState, form: FormData): Promise<BudgetFormState> {
  const raw = pickFormFields(form, BUDGET_FORM_FIELDS);
  const values = raw as Record<string, string>;

  const userId = await getUserId();
  if (!userId) return { status: "error", message: "Please sign in again.", values };

  const limit = settingsLimiterByUser.check(userId);
  if (!limit.allowed) return { status: "error", message: retryMessage(limit.retryAfterMs), values };

  const parsed = budgetSettingsSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.from("budget_settings").upsert(settingsToRow(parsed.data, userId));
  if (error) {
    console.error("saveBudgetSettings failed", error.code);
    return { status: "error", message: "Couldn't save your settings. Please try again.", values };
  }

  revalidatePath("/budget");
  revalidatePath("/report");
  revalidatePath("/log");
  return { status: "saved", values };
}
