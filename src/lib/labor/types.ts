// Know Your Rights data model. Rules live in the labor_rules table (seeded
// from supabase/seed/labor_rules.json). Every rule has a primary source and a
// "last verified" date; see .claude/rules/labor-data.md.

export const TOPICS = ["meal_break", "rest_break", "break_pay", "tip_credit", "manager_tips", "tip_pool", "card_fees"] as const;
export type Topic = (typeof TOPICS)[number];

/** The checklist questions, in display order. */
export const TOPIC_QUESTIONS: Record<Topic, string> = {
  meal_break: "Am I owed a meal break?",
  rest_break: "Am I owed short rest breaks?",
  break_pay: "Do my breaks have to be paid?",
  tip_credit: "Can my employer pay me less than minimum wage because I get tips?",
  manager_tips: "Can my employer or manager take part of my tips?",
  tip_pool: "Can I be required to share tips (tip pool or tip-out)?",
  card_fees: "Can my employer take card fees out of my tips?",
};

export const ANSWERS = ["yes", "no", "depends"] as const;
export type Answer = (typeof ANSWERS)[number];

export const RULE_STATUSES = ["draft", "published", "needs_review", "retired"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export const FEDERAL = "US";

export interface LaborRule {
  id: string;
  /** "US" for federal, or a two-letter state code. */
  jurisdiction: string;
  topic: Topic;
  answer: Answer;
  plainEnglish: string;
  legalBasis: string;
  sourceUrl: string;
  /** YYYY-MM-DD */
  lastVerifiedAt: string;
  /** Rules with dollar amounts expire when the rate changes (YYYY-MM-DD). */
  validThrough: string | null;
  reviewedBy: string;
  status: RuleStatus;
}

/** States with a verified dataset. Everything else falls back to federal rules with a clear notice. */
export const COVERED_STATES = ["CA", "FL", "IL", "NY", "TX"] as const;

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/** Where to ask questions or file a wage complaint. Each link was checked against the agency's own site. */
export const COMPLAINT_LINKS: Record<string, { label: string; url: string }> = {
  US: { label: "US Department of Labor, Wage and Hour Division", url: "https://www.dol.gov/agencies/whd/contact/complaints" },
  CA: { label: "California Labor Commissioner", url: "https://www.dir.ca.gov/dlse/howtofilewageclaim.htm" },
  IL: { label: "Illinois Department of Labor", url: "https://labor.illinois.gov/employees/rights.html" },
  NY: { label: "New York State Department of Labor", url: "https://dol.ny.gov/minimum-wage" },
  TX: { label: "Texas Workforce Commission", url: "https://www.twc.texas.gov/programs/wage-and-hour/texas-payday-law" },
};

export const STATE_OFFICES_URL = "https://www.dol.gov/agencies/whd/state/contacts";

export const DISCLAIMER = "General information, not legal advice.";
export const NOT_ATTORNEY_REVIEWED =
  "This information hasn't been reviewed by an employment attorney yet. Check the linked source before acting on it.";
