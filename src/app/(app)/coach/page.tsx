import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Coach" };

export default function CoachPage() {
  return (
    <ComingSoon
      title="Coach"
      description="Ask your Server Coach how to handle a tough table or what to upsell."
    />
  );
}
