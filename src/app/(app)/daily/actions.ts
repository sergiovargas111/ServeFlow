"use server";

import { revalidatePath } from "next/cache";
import { isNearToday } from "@/lib/daily/dates";
import { practiceLimiterByUser } from "@/lib/security/limits";
import { retryMessage } from "@/lib/security/rate-limit";
import { createClient, getUserId } from "@/lib/supabase/server";
import { habitSchema } from "@/lib/validation/learn";

export type HabitResult = { status: "saved" } | { status: "error"; message: string };

/** Checks a daily habit off (or back on) for the phone's current day. */
export async function setHabit(input: unknown): Promise<HabitResult> {
  const userId = await getUserId();
  if (!userId) return { status: "error", message: "Please sign in again." };
  const limit = practiceLimiterByUser.check(userId);
  if (!limit.allowed) return { status: "error", message: retryMessage(limit.retryAfterMs) };

  const parsed = habitSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Couldn't update that habit." };
  const { habitId, date, done } = parsed.data;
  if (!isNearToday(date, new Date().toISOString().slice(0, 10))) {
    return { status: "error", message: "Check your phone's date and try again." };
  }

  const supabase = await createClient();
  const row = { user_id: userId, task_id: habitId, completed_on: date };
  const { error } = done
    ? await supabase.from("task_completions").upsert(row, { onConflict: "user_id,task_id,completed_on", ignoreDuplicates: true })
    : await supabase.from("task_completions").delete().match(row);
  if (error) {
    console.error("setHabit failed", error.code);
    return { status: "error", message: "Couldn't update that habit. Please try again." };
  }
  revalidatePath("/daily");
  return { status: "saved" };
}
