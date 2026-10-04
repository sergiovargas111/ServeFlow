import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Daily" };

export default function DailyPage() {
  return (
    <ComingSoon
      title="Daily"
      description="Small daily habits and streaks. A slow night still counts."
    />
  );
}
