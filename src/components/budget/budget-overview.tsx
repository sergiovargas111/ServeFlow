"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { Info, Settings2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SAFE_TO_SPEND_EXPLAINER, TAXES_NOTE } from "@/lib/budget/messages";
import type { SplitAmounts } from "@/lib/budget/split";
import { buildBudgetView } from "@/lib/budget/summary";
import { SPLIT_BUCKETS, SPLIT_LABELS, type BudgetSettings } from "@/lib/budget/types";
import { FORECAST_DISCLAIMER } from "@/lib/forecast/messages";
import { localTodayIso } from "@/lib/shifts/dates";
import { formatCents } from "@/lib/shifts/money";
import type { ShiftRecord } from "@/lib/shifts/types";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};
const shortDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** "Today" comes from the phone's clock, so the budget renders on the client. */
export function BudgetOverview({ shifts, settings }: { shifts: ShiftRecord[]; settings: BudgetSettings }) {
  const today = useSyncExternalStore(noopSubscribe, () => localTodayIso(), () => null);
  if (!today) return <div className="h-96 animate-pulse rounded-xl bg-muted" aria-hidden />;
  return <BudgetView shifts={shifts} settings={settings} today={today} />;
}

function SplitList({ parts }: { parts: SplitAmounts }) {
  return (
    <ul className="divide-y text-sm">
      {SPLIT_BUCKETS.map((b) => (
        <li key={b} className="flex justify-between py-2">
          <span>{SPLIT_LABELS[b]}</span>
          <span className="font-medium tabular-nums">{formatCents(parts[b], { exact: true })}</span>
        </li>
      ))}
    </ul>
  );
}

function BudgetView({ shifts, settings, today }: { shifts: ShiftRecord[]; settings: BudgetSettings; today: string }) {
  const view = useMemo(() => buildBudgetView(shifts, settings, today), [shifts, settings, today]);
  const { week } = view;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardDescription>Safe to spend this week</CardDescription>
          <CardTitle className="text-4xl font-semibold tabular-nums">{formatCents(view.safeToSpendCents)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">{SAFE_TO_SPEND_EXPLAINER}</p>
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground">Made so far</dt>
              <dd className="text-lg font-medium tabular-nums">{formatCents(week.earnedCents)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Typical week ahead</dt>
              <dd className="text-lg font-medium tabular-nums">
                {week.typicalWeekCents === null
                  ? "—"
                  : week.remainingShifts > 0
                    ? `${formatCents(week.projectedLowCents)}–${formatCents(week.projectedHighCents)}`
                    : formatCents(week.projectedCents)}
              </dd>
            </div>
          </dl>
          {week.typicalWeekCents === null ? (
            <p className="text-xs text-muted-foreground">
              After a few weeks of logging, this counts your usual shifts still ahead this week.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {week.remainingShifts} usual shift{week.remainingShifts === 1 ? "" : "s"} left this week. {FORECAST_DISCLAIMER}
            </p>
          )}
        </CardContent>
      </Card>

      {view.alerts.map((a) => (
        <div key={a.headline} role="status" className="flex gap-3 rounded-xl border p-4 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">{a.headline}</p>
            <p className="text-muted-foreground">{a.detail}</p>
          </div>
        </div>
      ))}

      {view.latest ? (
        <Card>
          <CardHeader>
            <CardTitle>Where your last shift goes</CardTitle>
            <CardDescription>
              {shortDate.format(new Date(`${view.latest.date}T00:00:00Z`))} · {formatCents(view.latest.takeHomeCents, { exact: true })}{" "}
              take-home
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SplitList parts={view.latest.parts} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Log a shift to see your split</CardTitle>
            <CardDescription>Each night&apos;s take-home is divided into bills, savings, spending and taxes.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>A typical month</CardTitle>
          <CardDescription>
            {view.month
              ? `${formatCents(view.month.projection.monthlyCents)} take-home, based on your last ${view.month.projection.basisDays} days.`
              : "Needs 2 weeks of shifts."}
          </CardDescription>
        </CardHeader>
        {view.month ? (
          <CardContent>
            <SplitList parts={view.month.parts} />
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tip-outs and split</CardTitle>
          <CardDescription>
            {view.tipOuts.length > 0
              ? view.tipOuts.join(" · ")
              : "No tip-outs set. Add them so your numbers show what you take home."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{TAXES_NOTE}</p>
          <Link href="/budget/settings" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 w-full text-base")}>
            <Settings2 aria-hidden /> Edit tip-outs and split
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
