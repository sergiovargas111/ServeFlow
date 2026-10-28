import { formatCents } from "@/lib/shifts/money";
import type { SeasonalSlowWeek, WeekOutlook } from "./outlook";

/**
 * Budget alert copy. Same rule as the forecast: a slow week is a heads-up,
 * never a failure. Neutral words only, and always "based on your history".
 */

export interface BudgetAlert {
  headline: string;
  detail: string;
}

const weekOf = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function slowWeekAlert(outlook: WeekOutlook): BudgetAlert | null {
  if (!outlook.slow || outlook.typicalWeekCents === null) return null;
  return {
    headline: "This week is running lighter than usual",
    detail:
      `On pace for about ${formatCents(outlook.projectedCents)} next to a typical ${formatCents(outlook.typicalWeekCents)} week, ` +
      "based on your history. Weeks vary; it may be a good one to go easy on spending.",
  };
}

export function seasonalAlert(week: SeasonalSlowWeek): BudgetAlert {
  return {
    headline: `Heads up for the week of ${weekOf.format(new Date(`${week.weekStart}T00:00:00Z`))}`,
    detail: `Last year that week was about ${week.pctBelow}% slower than the weeks around it. Setting a little extra aside beforehand can help.`,
  };
}

export const SAFE_TO_SPEND_EXPLAINER =
  "Your spending share of a cautious week: what you've made so far plus 80% of what's typical for your usual shifts still ahead. Based on your history, not a guarantee.";

export const TAXES_NOTE = "The taxes amount is a savings target you choose, not tax advice.";
