"use server";

import { revalidatePath } from "next/cache";
import { shiftLogLimiterByUser } from "@/lib/security/limits";
import { retryMessage } from "@/lib/security/rate-limit";
import { toInsertRow } from "@/lib/shifts/rows";
import { createClient, getUserId } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/auth";
import { makeShiftSchema } from "@/lib/validation/shift";

export type LogShiftResult =
  | { status: "saved"; duplicate?: boolean }
  | { status: "error"; message?: string; fieldErrors?: Record<string, string>; retryable?: boolean };

const UNIQUE_VIOLATION = "23505";

/**
 * Saves one shift for the signed-in user. Called by the log form and by the
 * offline queue when the phone reconnects, so it takes a plain object and is
 * idempotent per clientId: a retried sync returns "saved" without a duplicate.
 */
export async function logShift(input: unknown): Promise<LogShiftResult> {
  const userId = await getUserId();
  if (!userId) return { status: "error", message: "Please sign in again." };

  const limit = shiftLogLimiterByUser.check(userId);
  if (!limit.allowed) return { status: "error", message: retryMessage(limit.retryAfterMs), retryable: true };

  // Server day in UTC. US users are always at or behind it, and the schema allows one extra day.
  const today = new Date().toISOString().slice(0, 10);
  const parsed = makeShiftSchema(today).safeParse(input);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("shifts").insert(toInsertRow(parsed.data, userId));
  if (error) {
    if (error.code === UNIQUE_VIOLATION && parsed.data.clientId) return { status: "saved", duplicate: true };
    // Never log the amounts; only the error code.
    console.error("logShift insert failed", error.code);
    return { status: "error", message: "Couldn't save that shift. Please try again.", retryable: true };
  }

  revalidatePath("/report");
  return { status: "saved" };
}
