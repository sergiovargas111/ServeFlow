import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SEED_ROWS, SEED_RULES } from "./dataset";
import { isPrimarySource, qualityReport, ruleProblems } from "./quality";
import { rowToRule } from "./rows";
import { TOPICS, type LaborRule } from "./types";

/**
 * CI gate for the labor-law dataset: fails the build if any published rule
 * is missing a source or date, cites a non-primary source, or can't load.
 */

const today = new Date().toISOString().slice(0, 10);

describe("labor dataset quality gate", () => {
  it("loads every seed row (no unknown topics, answers or statuses)", () => {
    expect(SEED_RULES).toHaveLength(SEED_ROWS.length);
  });

  it.each(SEED_RULES.filter((r) => r.status === "published").map((r) => [r.id, r] as const))(
    "published rule %s has a primary source, a verified date and a legal basis",
    (_id, rule) => {
      expect(ruleProblems(rule)).toEqual([]);
    },
  );

  it("has unique ids and one rule per jurisdiction and topic", () => {
    expect(new Set(SEED_RULES.map((r) => r.id)).size).toBe(SEED_RULES.length);
    expect(new Set(SEED_RULES.map((r) => `${r.jurisdiction}-${r.topic}`)).size).toBe(SEED_RULES.length);
  });

  it("names each rule after its jurisdiction and topic", () => {
    for (const r of SEED_RULES) expect(r.id).toBe(`${r.jurisdiction.toLowerCase()}-${r.topic}`);
  });

  it("covers every topic at the federal level", () => {
    expect(new Set(SEED_RULES.filter((r) => r.jurisdiction === "US").map((r) => r.topic))).toEqual(new Set(TOPICS));
  });

  it("covers 3 to 5 states, done right rather than all 50 done loosely", () => {
    const r = qualityReport(SEED_RULES, today);
    expect(r.statesCovered.length).toBeGreaterThanOrEqual(3);
    expect(r.statesCovered.length).toBeLessThanOrEqual(5);
    expect(r.problems).toEqual([]);
  });

  it("doesn't claim attorney review that hasn't happened", () => {
    expect(SEED_RULES.every((r) => r.reviewedBy === "pending attorney review")).toBe(true);
  });
});

describe("isPrimarySource", () => {
  it("accepts government and official statute sites", () => {
    for (const url of [
      "https://www.dol.gov/agencies/whd/state/meal-breaks",
      "https://www.dir.ca.gov/dlse/faq_mealperiods.htm",
      "https://efte.twc.texas.gov/d_breaks.html",
      "https://www.nysenate.gov/legislation/laws/LAB/162",
      "https://labor.illinois.gov/faqs/odrisa-faq.html",
    ]) {
      expect(isPrimarySource(url)).toBe(true);
    }
  });

  it("rejects blogs, look-alike domains, http and junk", () => {
    for (const url of [
      "https://www.somelawfirm.com/blog/tips",
      "https://dol.gov.evil.example/page",
      "https://notdol.gov/page",
      "http://www.dol.gov/agencies/whd",
      "javascript:alert(1)",
      "",
    ]) {
      expect(isPrimarySource(url)).toBe(false);
    }
  });
});

describe("ruleProblems", () => {
  const good = SEED_RULES[0];
  it("catches a missing source, date or basis", () => {
    const bad: LaborRule = { ...good, sourceUrl: "", lastVerifiedAt: "", legalBasis: "" };
    expect(ruleProblems(bad)).toEqual(
      expect.arrayContaining(["missing source_url", "missing or invalid last_verified_at", "missing legal_basis"]),
    );
  });

  it("catches a non-primary source", () => {
    expect(ruleProblems({ ...good, sourceUrl: "https://example.com/tips" })).toContain(
      "source_url is not a primary government source",
    );
  });

  it("catches a bad answer", () => {
    expect(ruleProblems({ ...good, answer: "maybe" as never })).toContain("answer must be yes, no or depends");
  });
});

describe("qualityReport", () => {
  it("counts stale rules", () => {
    expect(qualityReport(SEED_RULES, "2027-06-01").stale).toBeGreaterThan(0);
    expect(qualityReport([], today)).toMatchObject({ rules: 0, withSourcePct: 0, stale: 0 });
  });
});

describe("rowToRule", () => {
  it("drops rows with unknown values and trims timestamps to dates", () => {
    const row = { ...SEED_ROWS[0], last_verified_at: "2026-10-27T00:00:00+00:00" };
    expect(rowToRule(row)?.lastVerifiedAt).toBe("2026-10-27");
    expect(rowToRule({ ...row, topic: "vacation" })).toBeNull();
    expect(rowToRule({ ...row, answer: "maybe" })).toBeNull();
    expect(rowToRule({ ...row, status: "live" })).toBeNull();
  });
});

describe("migration", () => {
  it("allows exactly the topics the app knows", () => {
    const dir = join(__dirname, "../../../supabase/migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
    const m = /labor_rules_topic check \(\s*topic in \(([^)]*)\)/.exec(sql);
    expect(m).not.toBeNull();
    expect([...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])).toEqual([...TOPICS]);
  });
});
