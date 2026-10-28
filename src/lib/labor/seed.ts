import type { LaborRuleRow } from "./rows";

/**
 * Builds the SQL that loads supabase/seed/labor_rules.json into labor_rules.
 * Values are escaped as SQL string literals (single quotes doubled); the JSON
 * is our own reviewed data, never user input. A test keeps the committed .sql
 * in sync with the JSON.
 */

const literal = (v: string | null) => (v === null ? "null" : `'${v.replaceAll("'", "''")}'`);

const COLUMNS = [
  "id",
  "jurisdiction",
  "topic",
  "answer",
  "plain_english",
  "legal_basis",
  "source_url",
  "last_verified_at",
  "valid_through",
  "reviewed_by",
  "status",
] as const;

export function seedSql(rows: readonly LaborRuleRow[]): string {
  const values = rows
    .map((r) => `  (${COLUMNS.map((c) => literal(r[c])).join(", ")})`)
    .join(",\n");
  const updates = COLUMNS.filter((c) => c !== "id")
    .map((c) => `  ${c} = excluded.${c}`)
    .join(",\n");
  return `-- Generated from supabase/seed/labor_rules.json by \`npm run labor:seed\`. Do not edit by hand.
-- Run in the Supabase SQL editor (or psql) with a role that bypasses RLS.

insert into public.labor_rules (${COLUMNS.join(", ")})
values
${values}
on conflict (id) do update set
${updates};
`;
}
