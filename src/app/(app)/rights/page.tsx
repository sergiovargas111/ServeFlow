import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList, Info } from "lucide-react";
import { RuleCard } from "@/components/rights/rule-card";
import { StatePicker } from "@/components/rights/state-picker";
import { checklist, complaintLink, isCoveredState, normalizeState } from "@/lib/labor/lookup";
import { fetchLaborRules, fetchProfileState } from "@/lib/labor/queries";
import { DISCLAIMER, NOT_ATTORNEY_REVIEWED, US_STATES } from "@/lib/labor/types";
import { getUserId, isAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Know Your Rights" };

export default async function RightsPage() {
  const userId = await getUserId();
  const [rules, savedState, admin] = await Promise.all([
    fetchLaborRules(),
    userId ? fetchProfileState(userId) : Promise.resolve(null),
    isAdmin(),
  ]);
  const state = normalizeState(savedState);
  const today = new Date().toISOString().slice(0, 10);
  const items = checklist(rules, state, today);
  const contact = complaintLink(state);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Know Your Rights</h1>

      <div role="note" className="space-y-1 rounded-xl bg-muted p-4 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <Info className="size-4" aria-hidden /> {DISCLAIMER}
        </p>
        <p className="text-muted-foreground">{NOT_ATTORNEY_REVIEWED}</p>
      </div>

      <StatePicker state={state} />

      {state && !isCoveredState(state) ? (
        <p className="text-sm text-muted-foreground">
          We haven&apos;t verified {US_STATES[state]} law yet, so these are the federal rules only. Your state may give you more.
        </p>
      ) : null}
      {!state ? <p className="text-sm text-muted-foreground">Showing federal rules until you pick a state.</p> : null}

      <Link href="/rights/breaks" className="flex items-center gap-3 rounded-xl p-4 ring-1 ring-foreground/10 hover:bg-muted">
        <ClipboardList className="size-5 text-primary" aria-hidden />
        <span className="flex-1">
          <span className="block font-medium">Break log</span>
          <span className="block text-sm text-muted-foreground">Keep your own record of missed or short breaks.</span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Rules aren&apos;t available right now. Please check back soon.</p>
      ) : (
        items.map((item) => <RuleCard key={item.topic} item={item} state={state} />)
      )}

      <p className="text-sm">
        Questions or a complaint about your pay?{" "}
        <a href={contact.url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
          Contact the {contact.label}
        </a>
        .
      </p>

      {admin ? (
        <Link href="/admin/rules" className="block text-sm font-medium underline underline-offset-2">
          Admin: review rules
        </Link>
      ) : null}
    </div>
  );
}
