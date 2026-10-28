import { describe, expect, it } from "vitest";
import { SEED_ROWS, SEED_RULES } from "@/lib/labor/dataset";
import { qualityReport } from "@/lib/labor/quality";
import { seedSql } from "@/lib/labor/seed";

/**
 * Labor-law dataset report and seed check.
 * `npm run labor:report` prints the data-quality summary for docs/METRICS.md.
 * `npm run labor:seed` regenerates supabase/seed/labor_rules.sql from the JSON
 * (a file snapshot, so `-u` rewrites it). In `npm test` this fails CI if the
 * committed SQL is out of date.
 */

const today = new Date().toISOString().slice(0, 10);

describe("labor-law dataset", () => {
  it("prints the data-quality report", () => {
    const r = qualityReport(SEED_RULES, today);
    console.log(
      [
        `\nLabor-law dataset (${today})`,
        `states covered: ${r.statesCovered.length} (${r.statesCovered.join(", ")}) + federal baseline`,
        `rules: ${r.rules} (${r.published} published)`,
        `with source URL: ${r.withSourcePct}%  | primary source: ${r.primarySourcePct}%  | with verified date: ${r.withVerifiedDatePct}%`,
        `stale (90+ days or expired rate): ${r.stale}`,
        `attorney-reviewed: ${r.attorneyReviewed} of ${r.rules}`,
        `problems: ${r.problems.length}`,
      ].join("\n"),
    );
    expect(r.rules).toBe(SEED_ROWS.length);
  });

  it("keeps supabase/seed/labor_rules.sql in sync with the JSON", async () => {
    await expect(seedSql(SEED_ROWS)).toMatchFileSnapshot("../supabase/seed/labor_rules.sql");
  });
});
