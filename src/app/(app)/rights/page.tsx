import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Know Your Rights" };

export default function RightsPage() {
  return (
    <ComingSoon
      title="Know Your Rights"
      description="A sourced, state-by-state checklist of what your employer owes you."
    />
  );
}
