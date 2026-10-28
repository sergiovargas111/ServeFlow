import { projectedMonthly, type Projection } from "@/lib/report/trends";
import { takeHomeCents, type ShiftRecord } from "@/lib/shifts/types";
import { seasonalAlert, slowWeekAlert, type BudgetAlert } from "./messages";
import { safeToSpendCents, seasonalSlowWeeks, weekOutlook, type WeekOutlook } from "./outlook";
import { splitCents, type SplitAmounts } from "./split";
import { formatBp, TIP_OUT_ROLE_LABELS, TIP_OUT_ROLES, type BudgetSettings } from "./types";

export interface BudgetView {
  week: WeekOutlook;
  safeToSpendCents: number;
  alerts: BudgetAlert[];
  /** The most recent shift's take-home, split into buckets. */
  latest: { date: string; takeHomeCents: number; parts: SplitAmounts } | null;
  /** A typical month's take-home, split into buckets. */
  month: { projection: Projection; parts: SplitAmounts } | null;
  /** "Bar: 5% of tips" lines for the settings the user has. */
  tipOuts: string[];
}

export function buildBudgetView(shifts: readonly ShiftRecord[], settings: BudgetSettings, today: string): BudgetView {
  const week = weekOutlook(shifts, today);
  const alerts = [slowWeekAlert(week), ...seasonalSlowWeeks(shifts, today).map(seasonalAlert)].filter(
    (a): a is BudgetAlert => a !== null,
  );

  const past = shifts.filter((s) => s.date <= today);
  const last = past.length ? past.reduce((a, b) => (b.date > a.date ? b : a)) : null;
  const projection = projectedMonthly(shifts, today);

  return {
    week,
    safeToSpendCents: safeToSpendCents(week, settings.split),
    alerts,
    latest: last
      ? { date: last.date, takeHomeCents: takeHomeCents(last), parts: splitCents(takeHomeCents(last), settings.split) }
      : null,
    month: projection ? { projection, parts: splitCents(projection.monthlyCents, settings.split) } : null,
    tipOuts: TIP_OUT_ROLES.filter((r) => settings.tipOuts[r].bp > 0).map(
      (r) => `${TIP_OUT_ROLE_LABELS[r]}: ${formatBp(settings.tipOuts[r].bp)} of ${settings.tipOuts[r].basis}`,
    ),
  };
}
