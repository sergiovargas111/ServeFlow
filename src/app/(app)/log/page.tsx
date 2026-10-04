import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogShiftForm } from "@/components/shifts/log-shift-form";
import { fetchRecentShifts } from "@/lib/shifts/queries";

export const metadata: Metadata = { title: "Log a shift" };

export default async function LogShiftPage() {
  const history = await fetchRecentShifts();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/report" aria-label="Back to report" className="-ml-2 flex size-11 items-center justify-center">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Log a shift</h1>
      </div>
      <LogShiftForm history={history} />
    </div>
  );
}
