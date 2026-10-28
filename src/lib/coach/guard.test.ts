import { describe, expect, it } from "vitest";
import { SEED_RULES } from "@/lib/labor/dataset";
import { rulesFor } from "@/lib/labor/lookup";
import { guardReply, noVerifiedInfoReply } from "./guard";
import type { CoachOutput } from "./schema";

const caRules = rulesFor(SEED_RULES, "CA");
const out = (o: Partial<CoachOutput>): CoachOutput => ({ kind: "legal", covered: true, cited_rule_ids: [], reply: "Answer.", ...o });

describe("guardReply", () => {
  it("passes a cited legal answer through with sources from our own data", () => {
    const r = guardReply(out({ cited_rule_ids: ["ca-meal_break"], reply: "Yes, 30 minutes over 5 hours." }), caRules, "CA");
    expect(r).toMatchObject({ kind: "legal", covered: true, reply: "Yes, 30 minutes over 5 hours.", guarded: false });
    expect(r.sources).toEqual([
      expect.objectContaining({ id: "ca-meal_break", sourceUrl: "https://www.dir.ca.gov/dlse/faq_mealperiods.htm", lastVerifiedAt: "2026-10-27" }),
    ]);
    expect(r.disclaimer).toBe("General information, not legal advice.");
  });

  it("drops cited ids that weren't provided (no invented sources)", () => {
    const r = guardReply(out({ cited_rule_ids: ["ca-meal_break", "ny-meal_break", "made-up"] }), caRules, "CA");
    expect(r.sources.map((s) => s.id)).toEqual(["ca-meal_break"]);
    expect(r.guarded).toBe(true);
  });

  it("dedupes repeated citations", () => {
    expect(guardReply(out({ cited_rule_ids: ["ca-meal_break", "ca-meal_break"] }), caRules, "CA").sources).toHaveLength(1);
  });

  it("replaces a legal answer claimed as covered but with no valid citation", () => {
    const r = guardReply(out({ cited_rule_ids: ["invented-rule"], reply: "Tip-outs are always illegal." }), caRules, "CA");
    expect(r).toMatchObject({ covered: false, reply: noVerifiedInfoReply("CA"), sources: [], guarded: true });
    expect(r.reply).not.toContain("illegal");
  });

  it("always uses fixed wording for uncovered legal questions, never the model's", () => {
    const r = guardReply(out({ covered: false, reply: "Usually overtime is 1.5x after 40 hours." }), caRules, "CA");
    expect(r.reply).toBe(noVerifiedInfoReply("CA"));
    expect(r.helpLink?.url).toContain("dir.ca.gov");
  });

  it("points uncovered states to the DOL list of state labor offices", () => {
    const r = guardReply(out({ covered: false }), rulesFor(SEED_RULES, "WA"), "WA");
    expect(r.helpLink?.url).toBe("https://www.dol.gov/agencies/whd/state/contacts");
  });

  it("strips sources from serving and out-of-scope answers", () => {
    for (const kind of ["serving", "out_of_scope"] as const) {
      const r = guardReply(out({ kind, covered: true, cited_rule_ids: ["ca-meal_break"], reply: "Greet within a minute." }), caRules, "CA");
      expect(r).toMatchObject({ kind, covered: false, sources: [], disclaimer: null, reply: "Greet within a minute." });
    }
  });

  it("never claims a source for a rule from another state", () => {
    const r = guardReply(out({ cited_rule_ids: ["tx-tip_credit"] }), caRules, "CA");
    expect(r.covered).toBe(false);
  });
});
