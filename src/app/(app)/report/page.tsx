import type { Metadata } from "next";
import { Suspense } from "react";
import { TipReport } from "@/components/report/tip-report";
import { fetchRecentShifts } from "@/lib/shifts/queries";

export const metadata: Metadata = { title: "Tip Report" };

export default async function ReportPage() {
  const shifts = await fetchRecentShifts();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Tip Report</h1>
      <Suspense>
        <TipReport shifts={shifts} />
      </Suspense>
    </div>
  );
}
