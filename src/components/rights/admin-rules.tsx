"use client";

import { useState, useTransition } from "react";
import { updateRule } from "@/app/(app)/rights/actions";
import { Button } from "@/components/ui/button";
import { staleReason, STALE_MESSAGES } from "@/lib/labor/lookup";
import { RULE_STATUSES, TOPIC_QUESTIONS, type LaborRule, type RuleStatus } from "@/lib/labor/types";
import { AnswerBadge, SourceLine } from "./rule-card";

function RuleRow({ rule, today }: { rule: LaborRule; today: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const stale = staleReason(rule, today);

  function run(input: Parameters<typeof updateRule>[0]) {
    setMessage(null);
    startTransition(async () => {
      const r = await updateRule(input);
      setMessage(r.status === "saved" ? "Saved." : r.message);
    });
  }

  return (
    <li className="space-y-2 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">
          {rule.jurisdiction} · {TOPIC_QUESTIONS[rule.topic]}
        </p>
        <AnswerBadge answer={rule.answer} />
      </div>
      {stale ? <p className="text-xs font-medium">{STALE_MESSAGES[stale]}</p> : null}
      <SourceLine rule={rule} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run({ action: "verify", id: rule.id })}>
          Re-verified today
        </Button>
        <label className="sr-only" htmlFor={`status-${rule.id}`}>
          Status
        </label>
        <select
          id={`status-${rule.id}`}
          value={rule.status}
          disabled={pending}
          onChange={(e) => run({ action: "status", id: rule.id, status: e.target.value as RuleStatus })}
          className="h-8 rounded-lg border bg-transparent px-2 text-sm"
        >
          {RULE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
        {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
      </div>
    </li>
  );
}

/** Admin review list. Only re-verification dates and status are editable here; rule text changes go through the reviewed seed file. */
export function AdminRules({ rules, today }: { rules: LaborRule[]; today: string }) {
  return (
    <ul className="divide-y">
      {rules.map((r) => (
        <RuleRow key={r.id} rule={r} today={today} />
      ))}
    </ul>
  );
}
