import { daysBetween } from "@/lib/shifts/dates";
import { COMPLAINT_LINKS, COVERED_STATES, FEDERAL, STATE_OFFICES_URL, TOPICS, US_STATES, type LaborRule, type Topic } from "./types";

/**
 * Labor-rule lookup. Federal law is the baseline everywhere; a verified state
 * rule for the same topic takes precedence. If a covered state has no rule for
 * a topic, the federal rule is shown with a note that state law wasn't
 * checked for it. Nothing is ever guessed.
 */

export const STALE_AFTER_DAYS = 90;

/** Rules users can see. Drafts and retired rules never reach the app. */
export function isVisible(rule: LaborRule): boolean {
  return rule.status === "published" || rule.status === "needs_review";
}

export type StaleReason = "flagged" | "not_verified_90_days" | "rate_expired";

/** Why a rule needs review, or null when it's current. */
export function staleReason(rule: LaborRule, today: string): StaleReason | null {
  if (rule.status === "needs_review") return "flagged";
  if (rule.validThrough && rule.validThrough < today) return "rate_expired";
  if (daysBetween(rule.lastVerifiedAt, today) >= STALE_AFTER_DAYS) return "not_verified_90_days";
  return null;
}

export const STALE_MESSAGES: Record<StaleReason, string> = {
  flagged: "Needs review: this rule is being re-checked. Confirm with the source before relying on it.",
  not_verified_90_days: "Needs review: not re-verified in the last 90 days. Confirm with the source before relying on it.",
  rate_expired: "Needs review: the rate in this rule may have changed. Confirm with the source before relying on it.",
};

export type Coverage = "state" | "federal_only" | "state_not_covered";

export interface ChecklistItem {
  topic: Topic;
  rule: LaborRule;
  /** "state": a verified state rule. "federal_only": covered state, but no state rule on this topic yet. */
  coverage: Coverage;
  stale: StaleReason | null;
  /** The federal baseline, shown alongside a state rule. */
  federal: LaborRule | null;
}

export function normalizeState(state: string | null | undefined): string | null {
  const s = (state ?? "").trim().toUpperCase();
  return s in US_STATES ? s : null;
}

export function isCoveredState(state: string | null | undefined): boolean {
  const s = normalizeState(state);
  return s !== null && (COVERED_STATES as readonly string[]).includes(s);
}

/** The visible rule for a jurisdiction + topic (newest verification wins if there are duplicates). */
function find(rules: readonly LaborRule[], jurisdiction: string, topic: Topic): LaborRule | null {
  return (
    rules
      .filter((r) => r.jurisdiction === jurisdiction && r.topic === topic && isVisible(r))
      .sort((a, b) => b.lastVerifiedAt.localeCompare(a.lastVerifiedAt))[0] ?? null
  );
}

/** The checklist for a state (or federal only when no state is picked). Topics with no rule at all are left out. */
export function checklist(rules: readonly LaborRule[], state: string | null, today: string): ChecklistItem[] {
  const s = normalizeState(state);
  const covered = isCoveredState(s);
  const items: ChecklistItem[] = [];

  for (const topic of TOPICS) {
    const federal = find(rules, FEDERAL, topic);
    const stateRule = covered && s ? find(rules, s, topic) : null;
    const rule = stateRule ?? federal;
    if (!rule) continue;
    const coverage: Coverage = stateRule ? "state" : covered ? "federal_only" : s ? "state_not_covered" : "federal_only";
    items.push({ topic, rule, coverage, stale: staleReason(rule, today), federal: stateRule ? federal : null });
  }
  return items;
}

/** Visible rules that apply in a state: its own plus the federal baseline. Used to ground the coach. */
export function rulesFor(rules: readonly LaborRule[], state: string | null): LaborRule[] {
  const s = normalizeState(state);
  return rules.filter((r) => isVisible(r) && (r.jurisdiction === FEDERAL || (s !== null && r.jurisdiction === s)));
}

export function complaintLink(state: string | null): { label: string; url: string } {
  const s = normalizeState(state);
  if (s && COMPLAINT_LINKS[s]) return COMPLAINT_LINKS[s];
  if (s) return { label: `${US_STATES[s]} labor office (US Department of Labor list)`, url: STATE_OFFICES_URL };
  return COMPLAINT_LINKS[FEDERAL];
}
