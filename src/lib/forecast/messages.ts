import { DAY_NAMES } from "@/lib/shifts/dates";
import { formatCents } from "@/lib/shifts/money";
import type { ShiftType } from "@/lib/shifts/types";
import { MIN_SAMPLES, type Comparison, type Forecast } from "./engine";

/**
 * Copy for forecast results. Product rule: a slow night is never framed as a
 * failure. Below-forecast messages are neutral; only above-forecast messages
 * celebrate. There is deliberately no "negative" tone.
 */

export type Tone = "celebrate" | "neutral";

export interface ForecastMessage {
  tone: Tone;
  headline: string;
  detail?: string;
}

/** Within ±5% of the midpoint reads as "right around typical". */
export const NOTABLE_PCT = 5;

export const FORECAST_DISCLAIMER = "Based on your history. Not a guarantee.";

type GroupKey = Pick<Forecast, "dayOfWeek" | "shiftType" | "holiday">;

/** "Friday dinner", or "holiday dinner" for holiday forecasts. */
export function shiftLabel({ dayOfWeek, shiftType, holiday }: GroupKey): string {
  return `${holiday ? "holiday" : DAY_NAMES[dayOfWeek]} ${shiftType}`;
}

function pluralLabel(key: GroupKey): string {
  const type: Record<ShiftType, string> = { lunch: "lunches", dinner: "dinners", double: "doubles" };
  return `${key.holiday ? "holiday" : DAY_NAMES[key.dayOfWeek]} ${type[key.shiftType]}`;
}

/** "+14.6%" / "-8.0%" */
export function formatPct(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`;
}

export function rangeText(forecast: Extract<Forecast, { status: "ready" }>): string {
  return `${formatCents(forecast.p25)}–${formatCents(forecast.p75)}`;
}

export function lockedMessage(forecast: Extract<Forecast, { status: "locked" }>): ForecastMessage {
  return {
    tone: "neutral",
    headline: "Log a few more shifts to unlock your forecast",
    detail: `${forecast.sampleSize} of ${MIN_SAMPLES} ${pluralLabel(forecast)} logged so far.`,
  };
}

export function comparisonMessage(
  comparison: Comparison,
  forecast: Extract<Forecast, { status: "ready" }>,
): ForecastMessage {
  const label = shiftLabel(forecast);
  const detail = `Your typical ${label} is ${rangeText(forecast)}.`;
  const pct = comparison.pctVsMedian;

  if (pct === null) {
    return comparison.actual > 0
      ? { tone: "celebrate", headline: `Above your typical ${label}`, detail }
      : { tone: "neutral", headline: `Right around your typical ${label}`, detail };
  }
  if (pct >= NOTABLE_PCT) {
    return { tone: "celebrate", headline: `${formatPct(pct)} above your typical ${label}`, detail };
  }
  if (pct <= -NOTABLE_PCT) {
    const vary = forecast.holiday ? "Holidays vary." : `${DAY_NAMES[forecast.dayOfWeek]}s vary.`;
    return { tone: "neutral", headline: `Slower than usual. ${vary}`, detail };
  }
  return { tone: "neutral", headline: `Right around your typical ${label}`, detail };
}
