import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { LaborRule } from "@/lib/labor/types";
import { guardReply, type CoachReply } from "./guard";
import { COACH_SYSTEM_PROMPT, rulesContext } from "./prompt";
import { coachOutputSchema, type CoachRequest } from "./schema";

export const COACH_MODEL = "claude-opus-5-5";

export type CoachProvider = "anthropic" | "bedrock";

/** Model id per provider: Claude in Amazon Bedrock prefixes ids with "anthropic.". */
export const COACH_MODEL_IDS: Record<CoachProvider, string> = {
  anthropic: COACH_MODEL,
  bedrock: `anthropic.${COACH_MODEL}`,
};

/** The slice of the SDK client the coach uses, so tests can pass a fake. */
export type CoachClient = Pick<Anthropic, "beta">;

export type CoachResult =
  | { status: "ok"; reply: CoachReply }
  | { status: "error"; code: "declined" | "unavailable" | "rate_limited" | "bad_output"; message: string };

const UNAVAILABLE = "The coach can't answer right now. Please try again in a minute.";

/**
 * Asks Claude for one coach reply. Server-side only.
 * - The fixed instructions are a cached system block; the user's state and
 *   rules follow in a second block so the cached prefix never changes.
 * - Structured output (Zod schema) gives kind / covered / cited ids / reply.
 * - On the Claude API, fallbacks: "default" lets the API retry on Anthropic's
 *   recommended model if a safety classifier declines the request. Bedrock
 *   doesn't offer server-side fallbacks; a decline there is returned as "declined".
 * - The guard checks citations against the rules we sent before anything is returned.
 */
export async function runCoach(
  client: CoachClient,
  request: CoachRequest,
  state: string | null,
  rules: readonly LaborRule[],
  provider: CoachProvider = "anthropic",
): Promise<CoachResult> {
  let response;
  try {
    response = await client.beta.messages.parse({
      model: COACH_MODEL_IDS[provider],
      max_tokens: 4000,
      ...(provider === "anthropic" ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      output_config: { effort: "low", format: betaZodOutputFormat(coachOutputSchema) },
      system: [
        { type: "text", text: COACH_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        { type: "text", text: rulesContext(state, rules) },
      ],
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    });
  } catch (error) {
    // Most specific first. Never log message content or user data, only the status.
    if (error instanceof Anthropic.RateLimitError) {
      return { status: "error", code: "rate_limited", message: "The coach is busy. Please try again in a minute." };
    }
    if (error instanceof Anthropic.APIError) {
      console.error("coach: Claude API error", error.status);
      return { status: "error", code: "unavailable", message: UNAVAILABLE };
    }
    console.error("coach: request failed", error instanceof Error ? error.name : "unknown");
    return { status: "error", code: "unavailable", message: UNAVAILABLE };
  }

  if (response.stop_reason === "refusal") {
    return { status: "error", code: "declined", message: "The coach can't help with that one. Try asking another way." };
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    return { status: "error", code: "bad_output", message: UNAVAILABLE };
  }
  return { status: "ok", reply: guardReply(response.parsed_output, rules, state) };
}
