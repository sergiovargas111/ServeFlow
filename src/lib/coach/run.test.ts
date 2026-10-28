import Anthropic from "@anthropic-ai/sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SEED_RULES } from "@/lib/labor/dataset";
import { rulesFor } from "@/lib/labor/lookup";
import { COACH_SYSTEM_PROMPT } from "./prompt";
import { COACH_MODEL, runCoach, type CoachClient } from "./run";

const parse = vi.fn();
const client = { beta: { messages: { parse } } } as unknown as CoachClient;
const request = { messages: [{ role: "user" as const, content: "Am I owed a meal break?" }] };
const rules = rulesFor(SEED_RULES, "CA");

function reply(parsed_output: unknown, stop_reason = "end_turn") {
  return { stop_reason, parsed_output, content: [] };
}

beforeEach(() => {
  parse.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("runCoach", () => {
  it("sends a cached fixed system prompt, then the user's rules, with structured output and fallbacks", async () => {
    parse.mockResolvedValue(reply({ kind: "serving", covered: false, cited_rule_ids: [], reply: "Hi" }));
    await runCoach(client, request, "CA", rules);
    const params = parse.mock.calls[0][0];
    expect(params.model).toBe(COACH_MODEL);
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(params.system[0]).toEqual({ type: "text", text: COACH_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } });
    expect(params.system[1].text).toContain("California");
    expect(params.output_config.format).toBeDefined();
    expect(params.messages).toEqual(request.messages);
  });

  it("returns the guarded reply", async () => {
    parse.mockResolvedValue(reply({ kind: "legal", covered: true, cited_rule_ids: ["ca-meal_break"], reply: "Yes." }));
    const r = await runCoach(client, request, "CA", rules);
    expect(r).toMatchObject({ status: "ok", reply: { covered: true, sources: [expect.objectContaining({ id: "ca-meal_break" })] } });
  });

  it("handles a refusal without reading the content", async () => {
    parse.mockResolvedValue(reply(null, "refusal"));
    expect(await runCoach(client, request, "CA", rules)).toMatchObject({ status: "error", code: "declined" });
  });

  it("handles a truncated or unparseable answer", async () => {
    parse.mockResolvedValue(reply(null, "max_tokens"));
    expect((await runCoach(client, request, "CA", rules)).status).toBe("error");
    parse.mockResolvedValue(reply(null));
    expect(await runCoach(client, request, "CA", rules)).toMatchObject({ status: "error", code: "bad_output" });
  });

  it("maps a rate limit to a friendly retry message", async () => {
    parse.mockRejectedValue(new Anthropic.RateLimitError(429, undefined, "rate limited", new Headers()));
    expect(await runCoach(client, request, "CA", rules)).toMatchObject({ status: "error", code: "rate_limited" });
  });

  it("maps other API and network errors to unavailable, without logging content", async () => {
    parse.mockRejectedValue(new Anthropic.InternalServerError(500, undefined, "boom", new Headers()));
    expect(await runCoach(client, request, "CA", rules)).toMatchObject({ status: "error", code: "unavailable" });
    parse.mockRejectedValue(new TypeError("fetch failed"));
    expect(await runCoach(client, request, "CA", rules)).toMatchObject({ status: "error", code: "unavailable" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("meal break");
  });
});
