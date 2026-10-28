"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, RotateCcw, X } from "lucide-react";
import { submitDrill, type DrillResult } from "@/app/(app)/learn/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Question } from "@/lib/learn/content";
import { localTodayIso } from "@/lib/shifts/dates";
import { cn } from "@/lib/utils";

/**
 * Plays a drill one question at a time with instant feedback, then sends only
 * the chosen answers to the server, which grades and records the attempt.
 */
export function DrillPlayer({ drillId, questions, seed }: { drillId: string; questions: readonly Question[]; seed?: string }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<DrillResult | null>(null);
  const [pending, startTransition] = useTransition();

  const question = questions[index];
  const chosen = answers[index];
  const answered = chosen !== undefined;
  const last = index === questions.length - 1;

  function choose(i: number) {
    if (answered) return;
    setAnswers((a) => {
      const next = [...a];
      next[index] = i;
      return next;
    });
  }

  function finish() {
    startTransition(async () => {
      try {
        setResult(await submitDrill({ drillId, answers, completedOn: localTodayIso(), seed }));
      } catch {
        setResult({ status: "error", message: "You're offline. Your answers weren't saved; try again when you're back online." });
      }
    });
  }

  function restart() {
    setIndex(0);
    setAnswers([]);
    setResult(null);
  }

  if (result) {
    return (
      <div className="space-y-4" role="status">
        {result.status === "graded" ? (
          <div className="rounded-xl p-5 ring-1 ring-foreground/10">
            <p className="text-4xl font-semibold tabular-nums">
              {result.score}/{result.total}
            </p>
            <p className={cn("mt-1 font-medium", result.passed && "text-primary")}>
              {result.passed ? "Passed. Nice work." : "4 of 5 passes this drill. Practice makes it stick; try again anytime."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-destructive">{result.message}</p>
        )}
        <Button type="button" variant="outline" size="lg" className="h-12 w-full text-base" onClick={restart}>
          <RotateCcw aria-hidden /> Try again
        </Button>
        <Link href="/learn" className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}>
          Back to Learn
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Question {index + 1} of {questions.length}
      </p>
      <h2 className="text-lg font-semibold leading-snug">{question.prompt}</h2>
      <div className="space-y-2" role="group" aria-label="Answers">
        {question.choices.map((choice, i) => {
          const isRight = i === question.answer;
          const isChosen = i === chosen;
          return (
            <button
              key={choice}
              type="button"
              disabled={answered}
              onClick={() => choose(i)}
              className={cn(
                "flex min-h-12 w-full items-center gap-2 rounded-lg border px-4 py-3 text-left text-base",
                !answered && "hover:bg-muted",
                answered && isRight && "border-primary bg-primary/10",
                answered && isChosen && !isRight && "border-foreground/40 bg-muted",
              )}
            >
              <span className="flex-1">{choice}</span>
              {answered && isRight ? <Check className="size-5 text-primary" aria-label="Right answer" /> : null}
              {answered && isChosen && !isRight ? <X className="size-5 text-muted-foreground" aria-label="Your answer" /> : null}
            </button>
          );
        })}
      </div>

      {answered ? (
        <div className="space-y-3">
          <p className="rounded-lg bg-muted p-3 text-sm">
            <span className="font-medium">{chosen === question.answer ? "Right. " : "Not quite. "}</span>
            {question.why}
          </p>
          {last ? (
            <Button type="button" size="lg" className="h-14 w-full text-lg" disabled={pending} onClick={finish}>
              {pending ? "Checking…" : "Finish"}
            </Button>
          ) : (
            <Button type="button" size="lg" className="h-14 w-full text-lg" onClick={() => setIndex((i) => i + 1)}>
              Next question
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
