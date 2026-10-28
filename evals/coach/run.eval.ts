import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { gradeCase, summarize, type CaseGrade, type EvalCase } from "@/lib/coach/eval";
import { guardReply } from "@/lib/coach/guard";
import { COACH_MODEL, runCoach } from "@/lib/coach/run";
import type { CoachOutput } from "@/lib/coach/schema";
import { SEED_RULES } from "@/lib/labor/dataset";
import { rulesFor } from "@/lib/labor/lookup";
import cases from "./cases.json";

/**
 * Live coach eval: every case runs through the real prompt, model, structured
 * output and server guard, then is graded deterministically. Results go to
 * evals/coach/results/. Re-run after any change to the coach prompt or the
 * labor dataset, and copy the summary into docs/METRICS.md.
 */

const CONCURRENCY = 4;

describe.skipIf(!process.env.ANTHROPIC_API_KEY)("coach eval (live, calls the Claude API)", () => {
  it("runs every case and reports the scores", async () => {
    const client = new Anthropic();
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
              parse: async (params: Parameters<Anthropic["beta"]["messages"]["parse"]>[0]) => {
                const res = await client.beta.messages.parse(params);
                raw = (res.parsed_output as CoachOutput | null) ?? null;
                return res;
              },
            },
          },
        } as unknown as Pick<Anthropic, "beta">;
        const result = await runCoach(spy, { messages: [{ role: "user", content: c.question }] }, c.state, provided);
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
    writeFileSync(join(dir, `${date}.json`), `${JSON.stringify({ date, model: COACH_MODEL, summary, failures }, null, 2)}\n`);

    console.log(
      [
        `\nCoach eval ${date} (${COACH_MODEL}), ${summary.cases} cases`,
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
