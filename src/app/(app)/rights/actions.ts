"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { rightsLimiterByUser } from "@/lib/security/limits";
import { retryMessage } from "@/lib/security/rate-limit";
import { createClient, getUserId, isAdmin } from "@/lib/supabase/server";
import { fieldErrors, pickFormFields } from "@/lib/validation/auth";
import { adminRuleUpdateSchema, makeBreakLogSchema, stateSchema } from "@/lib/validation/rights";

async function session(): Promise<{ userId: string } | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Please sign in again." };
  const limit = rightsLimiterByUser.check(userId);
  if (!limit.allowed) return { error: retryMessage(limit.retryAfterMs) };
  return { userId };
}

export type SimpleResult = { status: "saved" } | { status: "error"; message: string };

/** Saves the user's state on their own profile (RLS: update own). */
export async function setState(input: unknown): Promise<SimpleResult> {
  const s = await session();
  if ("error" in s) return { status: "error", message: s.error };
  const parsed = stateSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Pick a US state." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ state: parsed.data.state ?? null }).eq("id", s.userId);
  if (error) return { status: "error", message: "Couldn't save your state. Please try again." };
  revalidatePath("/rights");
  revalidatePath("/coach");
  return { status: "saved" };
}

export type BreakFormState = {
  status: "idle" | "saved" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const BREAK_FIELDS = ["shiftDate", "breakType", "outcome", "minutes", "paid", "notes"] as const;

export async function logBreak(_prev: BreakFormState, form: FormData): Promise<BreakFormState> {
  const s = await session();
  if ("error" in s) return { status: "error", message: s.error };
  const parsed = makeBreakLogSchema(new Date().toISOString().slice(0, 10)).safeParse(pickFormFields(form, BREAK_FIELDS));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const { shiftDate, breakType, outcome, minutes, paid, notes } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("break_logs").insert({
    user_id: s.userId,
    shift_date: shiftDate,
    break_type: breakType,
    outcome,
    minutes: minutes ?? null,
    paid,
    notes: notes ?? null,
  });
  if (error) {
    console.error("logBreak failed", error.code);
    return { status: "error", message: "Couldn't save that break. Please try again." };
  }
  revalidatePath("/rights/breaks");
  return { status: "saved" };
}

export async function deleteBreak(id: unknown): Promise<{ ok: boolean }> {
  const s = await session();
  if ("error" in s) return { ok: false };
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("break_logs").delete().eq("id", parsed.data).eq("user_id", s.userId);
  if (error) return { ok: false };
  revalidatePath("/rights/breaks");
  return { ok: true };
}

/**
 * Admin-only: re-verify a rule (stamps today's date) or change its status.
 * Checked here on the server and again by RLS on labor_rules.
 */
export async function updateRule(input: unknown): Promise<SimpleResult> {
  const s = await session();
  if ("error" in s) return { status: "error", message: s.error };
  if (!(await isAdmin())) return { status: "error", message: "Only admins can edit rules." };
  const parsed = adminRuleUpdateSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid rule update." };

  const patch =
    parsed.data.action === "verify"
      ? { last_verified_at: new Date().toISOString().slice(0, 10) }
      : { status: parsed.data.status };
  const supabase = await createClient();
  const { error } = await supabase.from("labor_rules").update(patch).eq("id", parsed.data.id);
  if (error) return { status: "error", message: "Couldn't update that rule." };
  revalidatePath("/admin/rules");
  revalidatePath("/rights");
  return { status: "saved" };
}
