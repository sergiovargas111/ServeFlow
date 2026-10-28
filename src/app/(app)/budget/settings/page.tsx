import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BudgetSettingsForm } from "@/components/budget/budget-settings-form";
import { fetchBudgetSettings } from "@/lib/budget/queries";

export const metadata: Metadata = { title: "Tip-outs and split" };

export default async function BudgetSettingsPage() {
  const settings = await fetchBudgetSettings();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/budget" aria-label="Back to budget" className="-ml-2 flex size-11 items-center justify-center">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Tip-outs and split</h1>
      </div>
      <BudgetSettingsForm settings={settings} />
    </div>
  );
}
