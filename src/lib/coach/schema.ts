import { z } from "zod";

/**
 * What the model must return (structured output). The server never trusts it
 * blindly: cited ids are checked against the rules it was given, and an
 * uncited legal answer is replaced with the "no verified info" fallback.
 */
export const coachOutputSchema = z.object({
  /** serving: restaurant/serving advice. legal: a workplace-rights question. out_of_scope: anything else. */
  kind: z.enum(["serving", "legal", "out_of_scope"]),
  /** For legal questions: true only when the provided rules answer it. */
  covered: z.boolean(),
  /** Ids of the provided rules the reply relies on. Empty unless kind is legal and covered. */
  cited_rule_ids: z.array(z.string()),
  /** The answer shown to the user, plain text, a few short paragraphs at most. */
  reply: z.string(),
});

export type CoachOutput = z.infer<typeof coachOutputSchema>;

export const MAX_MESSAGE_CHARS = 1000;
export const MAX_TURNS = 20;

/** Request body for POST /api/coach. History alternates user/assistant and ends with the user's new message. */
export const coachRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z
          .string()
          .transform((s) => s.replaceAll("\u0000", "").trim())
          .refine((s) => s.length >= 1, { error: "Type a question." })
          .refine((s) => s.length <= MAX_MESSAGE_CHARS * 3, { error: "That message is too long." }),
      }),
    )
    .min(1)
    .max(MAX_TURNS)
    // Zod keeps running refinements after .min(1) fails, so each one guards against an empty list.
    .refine((m) => m.length > 0 && m[m.length - 1].role === "user", { error: "The last message must be yours." })
    .refine((m) => m.length > 0 && m[m.length - 1].content.length <= MAX_MESSAGE_CHARS, {
      error: `Keep questions under ${MAX_MESSAGE_CHARS} characters.`,
    })
    .refine((m) => m.length > 0 && m[0].role === "user" && m.every((x, i) => i === 0 || x.role !== m[i - 1].role), {
      error: "Messages must alternate.",
    }),
});

export type CoachRequest = z.infer<typeof coachRequestSchema>;
