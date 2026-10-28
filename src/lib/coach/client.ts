import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** Server-only Anthropic client, or null when the coach isn't configured (no ANTHROPIC_API_KEY). */
export function getCoachClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
}
