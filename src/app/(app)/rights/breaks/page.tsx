import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BreakLog } from "@/components/rights/break-log";
import { fetchBreakLogs } from "@/lib/labor/queries";

export const metadata: Metadata = { title: "Break log" };

export default async function BreaksPage() {
  const entries = await fetchBreakLogs();
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link href="/rights" aria-label="Back to Know Your Rights" className="-ml-2 flex size-11 items-center justify-center">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Break log</h1>
      </div>
      <BreakLog entries={entries} />
    </div>
  );
}
