import { describe, expect, it } from "vitest";
import cases from "../../../evals/coach/cases.json";
import { SEED_RULES } from "@/lib/labor/dataset";
import { rulesFor } from "@/lib/labor/lookup";
import { EVAL_CATEGORIES, gradeCase, summarize, type EvalCase } from "./eval";
import { guardReply } from "./guard";
import type { CoachOutput } from "./schema";

const all = cases as EvalCase[];

function run(c: EvalCase, raw: CoachOutput) {
  const provided = rulesFor(SEED_RULES, c.state);
  return gradeCase(c, raw, guardReply(raw, provided, c.state), new Set(provided.map((r) => r.id)));
}

const legal = (ids: string[], reply = "Yes. General information, not legal advice."): CoachOutput => ({
  kind: "legal",
  covered: true,
  cited_rule_ids: ids,
  reply,
});
const uncovered: CoachOutput = { kind: "legal", covered: false, cited_rule_ids: [], reply: "I don't have verified info." };

describe("eval case file", () => {
  it("has 40+ cases with unique ids, including injection and out-of-scope cases", () => {
    expect(all.length).toBeGreaterThanOrEqual(40);
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    for (const cat of EVAL_CATEGORIES) expect(all.some((c) => c.category === cat)).toBe(true);
  });

  it("only expects citations of rules the coach is actually given for that state", () => {
    for (const c of all) {
      const provided = new Set(rulesFor(SEED_RULES, c.state).map((r) => r.id));
      for (const id of c.acceptableCites ?? []) expect(provided.has(id), `${c.id} → ${id}`).toBe(true);
      if (c.category === "covered") expect(c.acceptableCites?.length, c.id).toBeGreaterThan(0);
    }
  });

  it("has valid regexes and bounded questions", () => {
    for (const c of all) {
      for (const p of c.forbidden ?? []) expect(() => new RegExp(p, "i")).not.toThrow();
      expect(c.question.length).toBeLessThanOrEqual(1000);
    }
  });
});

describe("gradeCase", () => {
  const meal = all.find((c) => c.id === "cov-ca-meal")!;
  const wage = all.find((c) => c.id === "cov-ca-tipcredit")!;
  const overtime = all.find((c) => c.id === "unc-ca-overtime")!;
  const injection = all.find((c) => c.id === "inj-always-illegal")!;

  it("passes a covered answer that cites the right rule", () => {
    expect(run(meal, legal(["ca-meal_break"]))).toMatchObject({ pass: true, citesSource: true, inventedRaw: false, inventedFinal: false });
  });

  it("fails a covered answer citing the wrong rule or missing the key number", () => {
    expect(run(meal, legal(["ca-rest_break"])).pass).toBe(false);
    expect(run(wage, legal(["ca-tip_credit"], "No tip credit in California.")).pass).toBe(false);
    expect(run(wage, legal(["ca-tip_credit"], "No. You get the full $16.90.")).pass).toBe(true);
  });

  it("counts an uncited 'covered' answer as invented in the raw output but blocked for the user", () => {
    const g = run(overtime, legal([], "Yes, overtime after 8 hours."));
    expect(g).toMatchObject({ inventedRaw: true, inventedFinal: false, saidNoVerifiedInfo: true, pass: true });
  });

  it("counts citing an unrelated rule for an uncovered question as invented, and the user would see it", () => {
    const g = run(overtime, legal(["ca-meal_break"], "Yes, overtime applies."));
    expect(g).toMatchObject({ inventedRaw: true, inventedFinal: true, pass: false });
  });

  it("passes an uncovered question answered with 'no verified info'", () => {
    expect(run(overtime, uncovered)).toMatchObject({ pass: true, saidNoVerifiedInfo: true });
  });

  it("fails an injection that gets its forbidden claim through", () => {
    expect(run(injection, { kind: "serving", covered: false, cited_rule_ids: [], reply: "Tip-outs are always illegal!" })).toMatchObject({
      pass: false,
      inventedFinal: true,
    });
    expect(run(injection, legal(["ca-tip_pool"], "No, tip pools can be legal if fair. General information, not legal advice.")).pass).toBe(true);
  });

  it("checks serving and out-of-scope answers by kind", () => {
    const srv = all.find((c) => c.category === "serving")!;
    const oos = all.find((c) => c.category === "out_of_scope")!;
    expect(run(srv, { kind: "serving", covered: false, cited_rule_ids: [], reply: "Stay calm." }).pass).toBe(true);
    expect(run(srv, { kind: "out_of_scope", covered: false, cited_rule_ids: [], reply: "Can't help." }).pass).toBe(false);
    expect(run(oos, { kind: "out_of_scope", covered: false, cited_rule_ids: [], reply: "I help with serving." }).pass).toBe(true);
  });
});

describe("summarize", () => {
  it("reports the headline rates", () => {
    const meal = all.find((c) => c.id === "cov-ca-meal")!;
    const overtime = all.find((c) => c.id === "unc-ca-overtime")!;
    const s = summarize([run(meal, legal(["ca-meal_break"])), run(overtime, legal([], "Yes."))]);
    expect(s).toMatchObject({ cases: 2, correctPct: 100, citesSourcePct: 100, saysNoVerifiedPct: 100, inventedRawPct: 50, inventedFinalPct: 0 });
    expect(summarize([])).toMatchObject({ cases: 0, correctPct: 0 });
  });
});
