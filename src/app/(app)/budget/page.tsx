import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BudgetOverview } from "@/components/budget/budget-overview";
import { fetchBudgetSettings } from "@/lib/budget/queries";
import { fetchRecentShifts } from "@/lib/shifts/queries";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetPage() {
  const [shifts, settings] = await Promise.all([fetchRecentShifts(), fetchBudgetSettings()]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/report" aria-label="Back to report" className="-ml-2 flex size-11 items-center justify-center">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
      </div>
      <BudgetOverview shifts={shifts} settings={settings} />
    </div>
  );
}
