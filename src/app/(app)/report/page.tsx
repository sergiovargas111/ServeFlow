import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Tip Report" };

export default function ReportPage() {
  return (
    <ComingSoon
      title="Tip Report"
      description="Your tip history, typical ranges and trends will live here."
    />
  );
}
