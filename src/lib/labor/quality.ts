import { isValidIsoDate } from "@/lib/shifts/dates";
import { staleReason } from "./lookup";
import { ANSWERS, FEDERAL, RULE_STATUSES, TOPICS, US_STATES, type LaborRule } from "./types";

/**
 * Data-quality checks for the labor-law dataset. CI fails if any published
 * rule breaks one of these (see quality.test.ts), and `npm run labor:report`
 * prints the summary for docs/METRICS.md.
 */

/** Primary sources only: federal and state government sites and official statute sites. */
export const PRIMARY_SOURCE_HOSTS = [
  "dol.gov",
  "ecfr.gov",
  "dir.ca.gov",
  "leginfo.legislature.ca.gov",
  "twc.texas.gov",
  "statutes.capitol.texas.gov",
  "dol.ny.gov",
  "nysenate.gov",
  "floridajobs.org",
  "flsenate.gov",
  "labor.illinois.gov",
  "ilga.gov",
] as const;

export function isPrimarySource(url: string): boolean {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  return PRIMARY_SOURCE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Problems with one rule; an empty list means it's fit to publish. */
export function ruleProblems(rule: LaborRule): string[] {
  const p: string[] = [];
  if (!/^[a-z]{2}-[a-z_]+$/.test(rule.id)) p.push("id must look like 'ca-meal_break'");
  if (rule.jurisdiction !== FEDERAL && !(rule.jurisdiction in US_STATES)) p.push("unknown jurisdiction");
  if (!(TOPICS as readonly string[]).includes(rule.topic)) p.push("unknown topic");
  if (!(ANSWERS as readonly string[]).includes(rule.answer)) p.push("answer must be yes, no or depends");
  if (!(RULE_STATUSES as readonly string[]).includes(rule.status)) p.push("unknown status");
  if (!rule.sourceUrl) p.push("missing source_url");
  else if (!isPrimarySource(rule.sourceUrl)) p.push("source_url is not a primary government source");
  if (!rule.lastVerifiedAt || !isValidIsoDate(rule.lastVerifiedAt)) p.push("missing or invalid last_verified_at");
  if (rule.validThrough !== null && !isValidIsoDate(rule.validThrough)) p.push("invalid valid_through");
  if (rule.legalBasis.trim().length < 5) p.push("missing legal_basis");
  if (rule.reviewedBy.trim().length === 0) p.push("missing reviewed_by");
  if (rule.plainEnglish.trim().length < 20) p.push("plain_english is too short");
  return p;
}

export interface QualityReport {
  statesCovered: string[];
  rules: number;
  published: number;
  withSourcePct: number;
  withVerifiedDatePct: number;
  primarySourcePct: number;
  stale: number;
  attorneyReviewed: number;
  problems: { id: string; problems: string[] }[];
}

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

export function qualityReport(rules: readonly LaborRule[], today: string): QualityReport {
  const published = rules.filter((r) => r.status === "published");
  return {
    statesCovered: [...new Set(rules.map((r) => r.jurisdiction).filter((j) => j !== FEDERAL))].sort(),
    rules: rules.length,
    published: published.length,
    withSourcePct: pct(rules.filter((r) => r.sourceUrl).length, rules.length),
    withVerifiedDatePct: pct(rules.filter((r) => isValidIsoDate(r.lastVerifiedAt ?? "")).length, rules.length),
    primarySourcePct: pct(rules.filter((r) => isPrimarySource(r.sourceUrl)).length, rules.length),
    stale: rules.filter((r) => staleReason(r, today) !== null).length,
    attorneyReviewed: rules.filter((r) => !/pending|unreviewed/i.test(r.reviewedBy)).length,
    problems: rules.map((r) => ({ id: r.id, problems: ruleProblems(r) })).filter((x) => x.problems.length > 0),
  };
}
