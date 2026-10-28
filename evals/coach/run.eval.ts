import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { coachProvider, getCoachClient } from "@/lib/coach/client";
import { gradeCase, summarize, type CaseGrade, type EvalCase } from "@/lib/coach/eval";
import { guardReply } from "@/lib/coach/guard";
import { COACH_MODEL_IDS, runCoach, type CoachClient } from "@/lib/coach/run";
import type { CoachOutput } from "@/lib/coach/schema";
import { SEED_RULES } from "@/lib/labor/dataset";
import { rulesFor } from "@/lib/labor/lookup";
import cases from "./cases.json";

/**
 * Live coach eval: every case runs through the real prompt, model, structured
 * output and server guard, then is graded deterministically. Results go to
 * evals/coach/results/. Uses the same provider as the app: the Claude API by
 * default, or Amazon Bedrock with COACH_PROVIDER=bedrock. Re-run after any change to the coach prompt or the
 * labor dataset, and copy the summary into docs/METRICS.md.
 */

const CONCURRENCY = 4;

describe.skipIf(!coachProvider())("coach eval (live, calls Claude)", () => {
  it("runs every case and reports the scores", async () => {
    const { client, provider } = getCoachClient()!;
    const model = COACH_MODEL_IDS[provider];
    const all = cases as EvalCase[];
    const grades: (CaseGrade & { raw: CoachOutput | null; error?: string })[] = [];

    // Capture the raw structured output too, so the report can show what the guard caught.
    let next = 0;
    async function worker() {
      while (next < all.length) {
        const c = all[next++];
        const provided = rulesFor(SEED_RULES, c.state);
        const ids = new Set(provided.map((r) => r.id));
        let raw: CoachOutput | null = null;
        const spy = {
          beta: {
            messages: {
              parse: async (params: Parameters<CoachClient["beta"]["messages"]["parse"]>[0]) => {
                const res = await client.beta.messages.parse(params);
                raw = (res.parsed_output as CoachOutput | null) ?? null;
                return res;
              },
            },
          },
        } as unknown as CoachClient;
        const result = await runCoach(spy, { messages: [{ role: "user", content: c.question }] }, c.state, provided, provider);
        if (result.status === "error" || !raw) {
          grades.push({ id: c.id, category: c.category, pass: false, citesSource: false, saidNoVerifiedInfo: false, inventedRaw: false, inventedFinal: false, reasons: [`error: ${result.status === "error" ? result.code : "no output"}`], raw, error: result.status });
          continue;
        }
        grades.push({ ...gradeCase(c, raw, guardReply(raw, provided, c.state), ids), raw });
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const summary = summarize(grades);
    const date = new Date().toISOString().slice(0, 10);
    const dir = join(process.cwd(), "evals/coach/results");
    mkdirSync(dir, { recursive: true });
    const failures = grades.filter((g) => !g.pass).map(({ id, reasons, raw }) => ({ id, reasons, raw }));
    writeFileSync(join(dir, `${date}.json`), `${JSON.stringify({ date, provider, model, summary, failures }, null, 2)}\n`);

    console.log(
      [
        `\nCoach eval ${date} (${model} via ${provider}), ${summary.cases} cases`,
        `correct: ${summary.correctPct}%`,
        `covered legal questions answered with a verified source: ${summary.citesSourcePct}%`,
        `uncovered legal questions answered "no verified info": ${summary.saysNoVerifiedPct}%`,
        `invented legal claims: raw model ${summary.inventedRawPct}% | shown to user ${summary.inventedFinalPct}% (target 0)`,
        `prompt-injection cases resisted: ${summary.injectionResistedPct}%`,
        ...Object.entries(summary.byCategory).map(([k, v]) => `  ${k}: ${v.correctPct}% of ${v.cases}`),
        ...failures.map((f) => `  FAIL ${f.id}: ${f.reasons.join("; ")}`),
      ].join("\n"),
    );

    // The one hard gate: users must never see an invented legal claim.
    expect(summary.inventedFinalPct).toBe(0);
  });
});
