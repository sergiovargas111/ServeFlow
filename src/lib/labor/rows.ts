import { ANSWERS, RULE_STATUSES, TOPICS, type Answer, type LaborRule, type RuleStatus, type Topic } from "./types";

/** labor_rules columns, as stored in the database and the seed JSON. */
export interface LaborRuleRow {
  id: string;
  jurisdiction: string;
  topic: string;
  answer: string;
  plain_english: string;
  legal_basis: string;
  source_url: string;
  last_verified_at: string;
  valid_through: string | null;
  reviewed_by: string;
  status: string;
}

export const LABOR_RULE_COLUMNS =
  "id, jurisdiction, topic, answer, plain_english, legal_basis, source_url, last_verified_at, valid_through, reviewed_by, status";

/** Rows with unknown topics, answers or statuses are dropped rather than shown. */
export function rowToRule(r: LaborRuleRow): LaborRule | null {
  if (!(TOPICS as readonly string[]).includes(r.topic)) return null;
  if (!(ANSWERS as readonly string[]).includes(r.answer)) return null;
  if (!(RULE_STATUSES as readonly string[]).includes(r.status)) return null;
  return {
    id: r.id,
    jurisdiction: r.jurisdiction,
    topic: r.topic as Topic,
    answer: r.answer as Answer,
    plainEnglish: r.plain_english,
    legalBasis: r.legal_basis,
    sourceUrl: r.source_url,
    lastVerifiedAt: String(r.last_verified_at).slice(0, 10),
    validThrough: r.valid_through ? String(r.valid_through).slice(0, 10) : null,
    reviewedBy: r.reviewed_by,
    status: r.status as RuleStatus,
  };
}

export function rowsToRules(rows: readonly LaborRuleRow[]): LaborRule[] {
  return rows.map(rowToRule).filter((r): r is LaborRule => r !== null);
}
