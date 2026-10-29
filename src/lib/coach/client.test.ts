import { describe, expect, it } from "vitest";
import { coachProvider } from "./client";

describe("coachProvider", () => {
  it("defaults to the Claude API when a key is set", () => {
    expect(coachProvider({ ANTHROPIC_API_KEY: "k" })).toBe("anthropic");
    expect(coachProvider({})).toBeNull();
  });

  it("uses Bedrock when asked and a region is set", () => {
    expect(coachProvider({ COACH_PROVIDER: "bedrock", AWS_REGION: "us-east-1" })).toBe("bedrock");
    expect(coachProvider({ COACH_PROVIDER: " Bedrock ", AWS_DEFAULT_REGION: "us-west-2" })).toBe("bedrock");
    expect(coachProvider({ COACH_PROVIDER: "bedrock" })).toBeNull();
  });

  it("doesn't fall back to another provider silently", () => {
    expect(coachProvider({ COACH_PROVIDER: "bedrock", ANTHROPIC_API_KEY: "k" })).toBeNull();
    expect(coachProvider({ COACH_PROVIDER: "openai", ANTHROPIC_API_KEY: "k" })).toBeNull();
  });
});
