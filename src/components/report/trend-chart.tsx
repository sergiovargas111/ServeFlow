"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Bucket } from "@/lib/report/trends";
import { formatCents } from "@/lib/shifts/money";

/**
 * Single-series take-home bars (no legend; the card title names the series).
 * Thin bars with a 4px rounded top, recessive grid, hover tooltip, and a
 * table view for screen readers and anyone who prefers numbers.
 */
export function TrendChart({ data, caption }: { data: Bucket[]; caption: string }) {
  const rows = data.map((b) => ({ ...b, dollars: b.totalCents / 100 }));

  return (
    <figure className="space-y-2">
      <div className="h-44" role="img" aria-label={`${caption}. ${summary(data)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tickCount={4}
              tickFormatter={(v: number) => formatCents(v * 100)}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              content={({ active, payload }) => {
                const b = active ? (payload?.[0]?.payload as (typeof rows)[number] | undefined) : undefined;
                if (!b) return null;
                return (
                  <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
                    <p className="font-medium">{b.label}</p>
                    <p>
                      {formatCents(b.totalCents)} · {b.shifts} shift{b.shifts === 1 ? "" : "s"}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="dollars" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Show as table</summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead className="text-muted-foreground">
            <tr>
              <th className="font-medium">Period</th>
              <th className="text-right font-medium">Take-home</th>
              <th className="text-right font-medium">Shifts</th>
            </tr>
          </thead>
          <tbody>
            {data.map((b) => (
              <tr key={b.key}>
                <td>{b.label}</td>
                <td className="text-right">{formatCents(b.totalCents)}</td>
                <td className="text-right">{b.shifts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function summary(data: Bucket[]): string {
  if (data.length === 0) return "No data.";
  const best = data.reduce((a, b) => (b.totalCents > a.totalCents ? b : a));
  const latest = data[data.length - 1];
  return `Latest ${latest.label}: ${formatCents(latest.totalCents)}. Highest: ${best.label}, ${formatCents(best.totalCents)}.`;
}
