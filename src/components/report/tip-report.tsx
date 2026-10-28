"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, CircleCheck, Plus, Sparkles, Wallet } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeToSpendCents, weekOutlook } from "@/lib/budget/outlook";
import type { BudgetSettings } from "@/lib/budget/types";
import { FORECAST_DISCLAIMER } from "@/lib/forecast/messages";
import { buildTipReport } from "@/lib/report/summary";
import { localTodayIso } from "@/lib/shifts/dates";
import { formatCents } from "@/lib/shifts/money";
import type { ShiftRecord } from "@/lib/shifts/types";
import { cn } from "@/lib/utils";
import { TrendChart } from "./trend-chart";

const noopSubscribe = () => () => {};
const shortDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** "Today" comes from the phone's clock, so the report renders on the client. */
export function TipReport({ shifts, settings }: { shifts: ShiftRecord[]; settings: BudgetSettings }) {
  const today = useSyncExternalStore(noopSubscribe, () => localTodayIso(), () => null);
  if (!today) return <div className="h-96 animate-pulse rounded-xl bg-muted" aria-hidden />;
  return <TipReportView shifts={shifts} settings={settings} today={today} />;
}

function BudgetLink({ shifts, settings, today }: { shifts: ShiftRecord[]; settings: BudgetSettings; today: string }) {
  const safe = useMemo(() => safeToSpendCents(weekOutlook(shifts, today), settings.split), [shifts, settings, today]);
  return (
    <Link href="/budget" className="flex items-center gap-3 rounded-xl p-4 ring-1 ring-foreground/10 hover:bg-muted">
      <Wallet className="size-5 text-primary" aria-hidden />
      <span className="flex-1">
        <span className="block text-sm text-muted-foreground">Safe to spend this week</span>
        <span className="text-lg font-semibold tabular-nums">{formatCents(safe)}</span>
      </span>
      <span className="flex items-center text-sm font-medium">
        Budget <ChevronRight className="size-4" aria-hidden />
      </span>
    </Link>
  );
}

function LogButton({ label }: { label: string }) {
  return (
    <Link href="/log" className={cn(buttonVariants({ size: "lg" }), "h-14 w-full text-lg")}>
      <Plus aria-hidden /> {label}
    </Link>
  );
}

function TipReportView({ shifts, settings, today }: { shifts: ShiftRecord[]; settings: BudgetSettings; today: string }) {
  const report = useMemo(() => buildTipReport(shifts, today), [shifts, today]);
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const justLogged = useSearchParams().get("logged") === "1";

  if (report.shiftCount === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Log your first shift</CardTitle>
            <CardDescription>
              It takes a few seconds. After 4 shifts of the same kind (like Friday dinners) you&apos;ll see what that
              shift typically makes.
            </CardDescription>
          </CardHeader>
        </Card>
        <LogButton label="Log a shift" />
      </div>
    );
  }

  const { latest } = report;

  return (
    <div className="space-y-4">
      {justLogged ? (
        <p role="status" className="flex items-center gap-2 text-sm font-medium text-primary">
          <CircleCheck className="size-4" aria-hidden /> Shift saved
        </p>
      ) : null}

      {latest ? (
        <Card className={cn(latest.message.tone === "celebrate" && "ring-primary/40")}>
          <CardHeader>
            <CardDescription>
              Last shift · {shortDate.format(new Date(`${latest.shift.date}T00:00:00Z`))} · {latest.shift.shiftType}
            </CardDescription>
            <CardTitle className="text-4xl font-semibold tabular-nums">{formatCents(latest.takeHomeCents, { exact: true })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className={cn("flex items-center gap-1.5 font-medium", latest.message.tone === "celebrate" && "text-primary")}>
              {latest.message.tone === "celebrate" ? <Sparkles className="size-4" aria-hidden /> : null}
              {latest.message.headline}
            </p>
            {latest.message.detail ? <p className="text-muted-foreground">{latest.message.detail}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <LogButton label="Log tonight's tips" />

      <BudgetLink shifts={shifts} settings={settings} today={today} />

      <div className="grid grid-cols-2 gap-3">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Average per shift</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {report.averagePerShiftCents === null ? "—" : formatCents(report.averagePerShiftCents)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {report.shiftCount} shift{report.shiftCount === 1 ? "" : "s"} logged
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardDescription>Typical month</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {report.projection ? formatCents(report.projection.monthlyCents) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {report.projection ? `Based on your last ${report.projection.basisDays} days` : "Needs 2 weeks of shifts"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Take-home</CardTitle>
          <div role="tablist" aria-label="Trend period" className="flex rounded-lg bg-muted p-0.5 text-sm">
            {(["weekly", "monthly"] as const).map((p) => (
              <button
                key={p}
                role="tab"
                type="button"
                aria-selected={period === p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "h-9 rounded-md px-3 capitalize",
                  period === p ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {period === "weekly" ? (
            <TrendChart data={report.weekly} caption="Take-home per week, last 8 weeks" />
          ) : (
            <TrendChart data={report.monthly} caption="Take-home per month, last 6 months" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your typical shifts</CardTitle>
          <CardDescription>{FORECAST_DISCLAIMER}</CardDescription>
        </CardHeader>
        <CardContent>
          {report.typical.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Log 4 of the same kind of shift (like 4 Friday dinners) to see its typical range.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {report.typical.map((t) => (
                <li key={t.key} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span>
                    <span className="font-medium">{t.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t.nextDate === today ? "Today" : shortDate.format(new Date(`${t.nextDate}T00:00:00Z`))} · {t.sampleSize} shifts
                    </span>
                  </span>
                  <span className="font-medium tabular-nums">{t.range}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
