import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminRules } from "@/components/rights/admin-rules";
import { qualityReport } from "@/lib/labor/quality";
import { fetchLaborRules } from "@/lib/labor/queries";
import { isAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Review labor rules" };

export default async function AdminRulesPage() {
  // Non-admins get a plain 404, so the page's existence isn't advertised.
  if (!(await isAdmin())) notFound();

  const rules = await fetchLaborRules();
  const today = new Date().toISOString().slice(0, 10);
  const report = qualityReport(rules, today);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Review labor rules</h1>
      <p className="text-sm text-muted-foreground">
        {report.rules} rules · {report.statesCovered.length} states · {report.stale} need review · {report.attorneyReviewed}{" "}
        attorney-reviewed. Re-verify against the source before marking a rule verified.
      </p>
      <AdminRules rules={rules} today={today} />
    </div>
  );
}
