import { describe, expect, it } from "vitest";
import { SEED_RULES } from "./dataset";
import { checklist, complaintLink, isCoveredState, normalizeState, rulesFor, staleReason, STALE_AFTER_DAYS } from "./lookup";
import { TOPICS, type LaborRule } from "./types";

const TODAY = "2026-10-28";

function rule(overrides: Partial<LaborRule>): LaborRule {
  return {
    id: "us-meal_break",
    jurisdiction: "US",
    topic: "meal_break",
    answer: "no",
    plainEnglish: "Federal law doesn't require meal breaks for anyone at all.",
    legalBasis: "FLSA",
    sourceUrl: "https://www.dol.gov/x",
    lastVerifiedAt: "2026-10-27",
    validThrough: null,
    reviewedBy: "pending attorney review",
    status: "published",
    ...overrides,
  };
}

const byTopic = (items: ReturnType<typeof checklist>) => Object.fromEntries(items.map((i) => [i.topic, i]));

describe("checklist", () => {
  it("uses the state rule over the federal baseline, and keeps the baseline alongside", () => {
    const ca = byTopic(checklist(SEED_RULES, "CA", TODAY));
    expect(ca.tip_credit.rule.id).toBe("ca-tip_credit");
    expect(ca.tip_credit.rule.answer).toBe("no");
    expect(ca.tip_credit.coverage).toBe("state");
    expect(ca.tip_credit.federal?.id).toBe("us-tip_credit");
  });

  it("falls back to federal for a covered state with no rule on a topic, and says so", () => {
    const tx = byTopic(checklist(SEED_RULES, "TX", TODAY));
    expect(tx.card_fees.rule.id).toBe("us-card_fees");
    expect(tx.card_fees.coverage).toBe("federal_only");
    expect(tx.card_fees.federal).toBeNull();
  });

  it("shows only federal rules for a state with no verified data, flagged as not covered", () => {
    const wa = checklist(SEED_RULES, "WA", TODAY);
    expect(wa).toHaveLength(TOPICS.length);
    expect(wa.every((i) => i.rule.jurisdiction === "US" && i.coverage === "state_not_covered")).toBe(true);
  });

  it("shows federal rules when no state is picked", () => {
    const none = checklist(SEED_RULES, null, TODAY);
    expect(none.every((i) => i.rule.jurisdiction === "US" && i.coverage === "federal_only")).toBe(true);
  });

  it("answers every topic for every covered state", () => {
    for (const s of ["CA", "FL", "IL", "NY", "TX"]) expect(checklist(SEED_RULES, s, TODAY)).toHaveLength(TOPICS.length);
  });

  it("returns nothing when there are no rules at all", () => {
    expect(checklist([], "CA", TODAY)).toEqual([]);
  });

  it("never shows draft or retired rules", () => {
    const rules = [rule({ status: "draft" }), rule({ id: "ca-meal_break", jurisdiction: "CA", status: "retired" })];
    expect(checklist(rules, "CA", TODAY)).toEqual([]);
  });

  it("returns Depends for New York meal breaks rather than a yes/no guess", () => {
    expect(byTopic(checklist(SEED_RULES, "NY", TODAY)).meal_break.rule.answer).toBe("depends");
  });
});

describe("staleReason", () => {
  it("is null for a freshly verified rule", () => {
    expect(staleReason(rule({}), TODAY)).toBeNull();
  });

  it(`flags rules not verified in ${STALE_AFTER_DAYS}+ days, and allows 89`, () => {
    expect(staleReason(rule({ lastVerifiedAt: "2026-07-31" }), TODAY)).toBeNull(); // 89 days
    expect(staleReason(rule({ lastVerifiedAt: "2026-07-30" }), TODAY)).toBe("not_verified_90_days"); // 90 days
    expect(staleReason(rule({ lastVerifiedAt: "2025-01-01" }), TODAY)).toBe("not_verified_90_days");
  });

  it("flags a rule whose rate has expired", () => {
    expect(staleReason(rule({ validThrough: "2026-10-27" }), TODAY)).toBe("rate_expired");
    expect(staleReason(rule({ validThrough: "2026-10-28" }), TODAY)).toBeNull();
  });

  it("flags a rule an admin marked needs_review", () => {
    expect(staleReason(rule({ status: "needs_review" }), TODAY)).toBe("flagged");
  });

  it("flags New York's 2026 tipped wage once 2027 starts", () => {
    const ny = SEED_RULES.find((r) => r.id === "ny-tip_credit")!;
    expect(staleReason(ny, "2026-12-31")).toBeNull();
    expect(staleReason(ny, "2027-01-01")).toBe("rate_expired");
  });
});

describe("helpers", () => {
  it("normalizes state codes and rejects unknown ones", () => {
    expect(normalizeState(" ca ")).toBe("CA");
    expect(normalizeState("ZZ")).toBeNull();
    expect(normalizeState(null)).toBeNull();
    expect(isCoveredState("ny")).toBe(true);
    expect(isCoveredState("WA")).toBe(false);
  });

  it("returns only a state's own rules plus federal ones", () => {
    const ca = rulesFor(SEED_RULES, "CA");
    expect(new Set(ca.map((r) => r.jurisdiction))).toEqual(new Set(["US", "CA"]));
    expect(rulesFor(SEED_RULES, null).every((r) => r.jurisdiction === "US")).toBe(true);
  });

  it("links to the state labor department, or the DOL list for uncovered states", () => {
    expect(complaintLink("CA").url).toContain("dir.ca.gov");
    expect(complaintLink("WA")).toMatchObject({ url: "https://www.dol.gov/agencies/whd/state/contacts" });
    expect(complaintLink(null).url).toContain("dol.gov");
    expect(complaintLink("FL").url).toContain("dol.gov");
  });
});
