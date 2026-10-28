"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isNearToday } from "@/lib/daily/dates";
import { getDrill, type Question } from "@/lib/learn/content";
import { buildMenuQuiz, MENU_DRILL_ID } from "@/lib/learn/menu-quiz";
import { grade, isDrillUnlocked } from "@/lib/learn/progress";
import { rowToAttempt, rowToMenuItem } from "@/lib/learn/queries";
import { practiceLimiterByUser } from "@/lib/security/limits";
import { retryMessage } from "@/lib/security/rate-limit";
import { createClient, getUserId } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/auth";
import { drillSubmissionSchema, MAX_MENU_ITEMS, menuItemSchema } from "@/lib/validation/learn";

export type DrillResult =
  | { status: "graded"; score: number; total: number; passed: boolean; results: boolean[] }
  | { status: "error"; message: string };

const serverToday = () => new Date().toISOString().slice(0, 10);

async function session(): Promise<{ userId: string } | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Please sign in again." };
  const limit = practiceLimiterByUser.check(userId);
  if (!limit.allowed) return { error: retryMessage(limit.retryAfterMs) };
  return { userId };
}

/**
 * Grades a finished drill on the server and records the attempt. The client
 * sends only the chosen answers; the score is never taken from the client.
 */
export async function submitDrill(input: unknown): Promise<DrillResult> {
  const s = await session();
  if ("error" in s) return { status: "error", message: s.error };

  const parsed = drillSubmissionSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "That drill couldn't be checked. Please try again." };
  const { drillId, answers, completedOn, seed } = parsed.data;
  if (!isNearToday(completedOn, serverToday())) return { status: "error", message: "Check your phone's date and try again." };

  const supabase = await createClient();
  let questions: readonly Question[];
  if (drillId === MENU_DRILL_ID) {
    if (!seed) return { status: "error", message: "That quiz couldn't be checked. Please try again." };
    const { data, error } = await supabase.from("menu_items").select("id, name, description, allergens").limit(500);
    if (error) return { status: "error", message: "Couldn't check your answers. Please try again." };
    questions = buildMenuQuiz((data ?? []).map(rowToMenuItem), seed);
    if (questions.length === 0) return { status: "error", message: "Add a few more menu items first." };
  } else {
    const drill = getDrill(drillId);
    if (!drill) return { status: "error", message: "Unknown drill." };
    const { data, error } = await supabase.from("drill_attempts").select("drill_id, score, total, completed_on").limit(5000);
    if (error) return { status: "error", message: "Couldn't check your answers. Please try again." };
    if (!isDrillUnlocked(drill, (data ?? []).map(rowToAttempt))) {
      return { status: "error", message: "Finish the level before this one to unlock this drill." };
    }
    questions = drill.questions;
  }

  const result = grade(questions, answers);
  const { error } = await supabase.from("drill_attempts").insert({
    user_id: s.userId,
    drill_id: drillId,
    score: result.score,
    total: result.total,
    completed_on: completedOn,
  });
  if (error) {
    console.error("submitDrill insert failed", error.code);
    return { status: "error", message: "Couldn't save your result. Please try again." };
  }

  revalidatePath("/learn");
  revalidatePath("/daily");
  return { status: "graded", ...result };
}

export type MenuFormState = {
  status: "idle" | "saved" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

export async function addMenuItem(_prev: MenuFormState, form: FormData): Promise<MenuFormState> {
  const s = await session();
  if ("error" in s) return { status: "error", message: s.error };

  const name = form.get("name");
  const description = form.get("description");
  const parsed = menuItemSchema.safeParse({
    name: typeof name === "string" ? name : undefined,
    description: typeof description === "string" ? description : "",
    allergens: form.getAll("allergens").filter((a) => typeof a === "string"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { count, error: countError } = await supabase.from("menu_items").select("id", { count: "exact", head: true });
  if (countError) return { status: "error", message: "Couldn't save that dish. Please try again." };
  if ((count ?? 0) >= MAX_MENU_ITEMS) return { status: "error", message: `Your menu is limited to ${MAX_MENU_ITEMS} dishes.` };

  const { error } = await supabase.from("menu_items").insert({ ...parsed.data, user_id: s.userId });
  if (error) {
    console.error("addMenuItem failed", error.code);
    return { status: "error", message: "Couldn't save that dish. Please try again." };
  }
  revalidatePath("/learn/menu");
  revalidatePath("/learn");
  return { status: "saved" };
}

export async function deleteMenuItem(id: unknown): Promise<{ ok: boolean }> {
  const s = await session();
  if ("error" in s) return { ok: false };
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  // RLS limits the delete to the user's own rows; the user_id filter is a second guard.
  const { error } = await supabase.from("menu_items").delete().eq("id", parsed.data).eq("user_id", s.userId);
  if (error) return { ok: false };
  revalidatePath("/learn/menu");
  revalidatePath("/learn");
  return { ok: true };
}
