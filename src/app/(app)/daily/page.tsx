import type { Metadata } from "next";
import { DailyView } from "@/components/daily/daily-view";
import { fetchAttempts, fetchHabitCompletions } from "@/lib/learn/queries";
import { fetchRecentShifts } from "@/lib/shifts/queries";

export const metadata: Metadata = { title: "Daily" };

export default async function DailyPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [shifts, attempts, habits] = await Promise.all([fetchRecentShifts(), fetchAttempts(), fetchHabitCompletions(today)]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Daily</h1>
      <DailyView shiftDates={[...new Set(shifts.map((s) => s.date))]} attempts={attempts} habits={habits} />
    </div>
  );
}
