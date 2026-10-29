import type { Metadata } from "next";
import { CoachChat } from "@/components/coach/coach-chat";

export const metadata: Metadata = { title: "Server Coach" };

export default function CoachPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Server Coach</h1>
      <CoachChat />
    </div>
  );
}
