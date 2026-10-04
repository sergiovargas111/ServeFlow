import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Learn" };

export default function LearnPage() {
  return (
    <ComingSoon
      title="Learn"
      description="Practice drills and levels: menu quizzes, upselling, wine pairings."
    />
  );
}
