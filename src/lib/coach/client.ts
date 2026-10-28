import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import type { CoachClient, CoachProvider } from "./run";

/**
 * Which Claude provider the coach uses. Server-only.
 * - "anthropic" (default): the Claude API, needs ANTHROPIC_API_KEY.
 * - "bedrock": Claude in Amazon Bedrock (COACH_PROVIDER=bedrock), needs AWS_REGION
 *   plus AWS credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, an AWS
 *   profile, or AWS_BEARER_TOKEN_BEDROCK), resolved by the SDK.
 * Returns null when the chosen provider isn't configured.
 */
export function coachProvider(env: Record<string, string | undefined> = process.env): CoachProvider | null {
  const choice = (env.COACH_PROVIDER ?? "anthropic").trim().toLowerCase();
  if (choice === "bedrock") return env.AWS_REGION || env.AWS_DEFAULT_REGION ? "bedrock" : null;
  if (choice === "anthropic") return env.ANTHROPIC_API_KEY ? "anthropic" : null;
  return null;
}

let cached: { provider: CoachProvider; client: CoachClient } | null = null;

export function getCoachClient(): { provider: CoachProvider; client: CoachClient } | null {
  const provider = coachProvider();
  if (!provider) return null;
  if (cached?.provider !== provider) {
    // The Bedrock client serves the same beta.messages API the coach uses.
    const client = provider === "bedrock" ? (new AnthropicBedrockMantle() as unknown as CoachClient) : new Anthropic();
    cached = { provider, client };
  }
  return cached;
}
