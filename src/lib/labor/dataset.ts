import seed from "../../../supabase/seed/labor_rules.json";
import { rowsToRules, type LaborRuleRow } from "./rows";

/**
 * The reviewed seed dataset, as loaded into labor_rules. The app reads the
 * database; this copy is for data-quality checks, the seed SQL and coach
 * evals, so they all test exactly what ships.
 */
export const SEED_ROWS = seed as LaborRuleRow[];
export const SEED_RULES = rowsToRules(SEED_ROWS);
