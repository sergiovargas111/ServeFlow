import { getCoachClient } from "@/lib/coach/client";
import { runCoach } from "@/lib/coach/run";
import { coachRequestSchema } from "@/lib/coach/schema";
import { rulesFor } from "@/lib/labor/lookup";
import { fetchLaborRules, fetchProfileState } from "@/lib/labor/queries";
import { coachLimiterByUser } from "@/lib/security/limits";
import { retryMessage } from "@/lib/security/rate-limit";
import { getUserId } from "@/lib/supabase/server";

/** Requests bigger than this are rejected before parsing (20 turns of short messages fit easily). */
export const MAX_BODY_BYTES = 32_000;

const error = (status: number, message: string, headers?: HeadersInit) =>
  Response.json({ status: "error", message }, { status, headers });

/**
 * POST /api/coach. Signed-in users only, rate-limited per user, body capped
 * and validated with Zod. Legal answers are grounded in the user's state's
 * verified rules and checked server-side before they're returned.
 */
export async function POST(request: Request): Promise<Response> {
  // No session (or auth not configured at all) is the same answer: sign in.
  const userId = await getUserId().catch(() => null);
  if (!userId) return error(401, "Please sign in again.");

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return error(413, "That message is too long.");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return error(413, "That message is too long.");

  const limit = coachLimiterByUser.check(userId);
  if (!limit.allowed) {
    return error(429, retryMessage(limit.retryAfterMs), { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return error(400, "Invalid request.");
  }
  const parsed = coachRequestSchema.safeParse(body);
  if (!parsed.success) return error(400, parsed.error.issues[0]?.message ?? "Invalid request.");

  const client = getCoachClient();
  if (!client) return error(503, "The coach isn't set up yet.");

  const [state, allRules] = await Promise.all([fetchProfileState(userId), fetchLaborRules()]);
  const result = await runCoach(client, parsed.data, state, rulesFor(allRules, state));
  if (result.status === "error") {
    return error(result.code === "rate_limited" ? 429 : result.code === "declined" ? 422 : 503, result.message);
  }
  return Response.json({ status: "ok", ...result.reply });
}
