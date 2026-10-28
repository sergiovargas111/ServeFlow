import { ExternalLink, TriangleAlert } from "lucide-react";
import { STALE_MESSAGES, type ChecklistItem } from "@/lib/labor/lookup";
import { TOPIC_QUESTIONS, US_STATES, type Answer, type LaborRule } from "@/lib/labor/types";
import { cn } from "@/lib/utils";

const verified = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const ANSWER_LABEL: Record<Answer, string> = { yes: "Yes", no: "No", depends: "Depends" };

export function AnswerBadge({ answer }: { answer: Answer }) {
  // Neutral styling for every answer: this is information, not a verdict.
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-full px-3 text-sm font-semibold",
        answer === "yes" && "bg-primary/10 text-primary",
        answer === "no" && "bg-muted text-foreground",
        answer === "depends" && "border border-foreground/20 text-foreground",
      )}
    >
      {ANSWER_LABEL[answer]}
    </span>
  );
}

export function SourceLine({ rule }: { rule: LaborRule }) {
  const host = new URL(rule.sourceUrl).hostname.replace(/^www\./, "");
  return (
    <p className="text-xs text-muted-foreground">
      <a href={rule.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
        Source: {host} <ExternalLink className="size-3" aria-hidden />
      </a>{" "}
      · {rule.legalBasis} · Last verified {verified.format(new Date(`${rule.lastVerifiedAt}T00:00:00Z`))}
    </p>
  );
}

export function RuleCard({ item, state }: { item: ChecklistItem; state: string | null }) {
  const { rule } = item;
  const stateName = state ? US_STATES[state] : null;
  return (
    <article className="space-y-2 rounded-xl p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-medium leading-snug">{TOPIC_QUESTIONS[item.topic]}</h2>
        <AnswerBadge answer={rule.answer} />
      </div>
      <p className="text-sm">{rule.plainEnglish}</p>
      {item.coverage === "federal_only" && stateName ? (
        <p className="text-xs text-muted-foreground">
          This is the federal rule. We haven&apos;t verified {stateName} law on this topic yet, and it may add protections.
        </p>
      ) : null}
      {item.stale ? (
        <p role="note" className="flex items-start gap-1.5 text-xs font-medium">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {STALE_MESSAGES[item.stale]}
        </p>
      ) : null}
      <SourceLine rule={rule} />
      {item.federal ? (
        <details className="text-sm">
          <summary className="cursor-pointer py-1 text-xs font-medium text-muted-foreground">Federal baseline</summary>
          <div className="space-y-1 pt-1">
            <AnswerBadge answer={item.federal.answer} />
            <p>{item.federal.plainEnglish}</p>
            <SourceLine rule={item.federal} />
          </div>
        </details>
      ) : null}
    </article>
  );
}
