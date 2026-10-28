"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteBreak, logBreak, type BreakFormState } from "@/app/(app)/rights/actions";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  BREAK_OUTCOME_LABELS,
  BREAK_OUTCOMES,
  BREAK_PAID,
  BREAK_PAID_LABELS,
  BREAK_TYPE_LABELS,
  BREAK_TYPES,
} from "@/lib/labor/breaks";
import type { BreakLog as BreakLogEntry } from "@/lib/labor/queries";
import { localTodayIso } from "@/lib/shifts/dates";
import { cn } from "@/lib/utils";

const initial: BreakFormState = { status: "idle" };
const noopSubscribe = () => () => {};
const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function Choice<T extends string>({
  name,
  legend,
  options,
  labels,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <input type="hidden" name={name} value={value} />
      <div role="radiogroup" aria-label={legend} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(o)}
            className={cn(
              "h-10 rounded-full border px-4 text-sm",
              value === o ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted",
            )}
          >
            {labels[o]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function BreakForm() {
  const [state, action, pending] = useActionState(logBreak, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const today = useSyncExternalStore(noopSubscribe, () => localTodayIso(), () => "");
  const [breakType, setBreakType] = useState<(typeof BREAK_TYPES)[number]>("meal");
  const [outcome, setOutcome] = useState<(typeof BREAK_OUTCOMES)[number]>("missed");
  const [paid, setPaid] = useState<(typeof BREAK_PAID)[number]>("unsure");

  useEffect(() => {
    if (state.status === "saved") formRef.current?.reset();
  }, [state]);

  const err = state.fieldErrors ?? {};
  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      <FormField name="shiftDate" label="Shift date" type="date" defaultValue={today} max={today} error={err.shiftDate} key={today} />
      <Choice name="breakType" legend="Break" options={BREAK_TYPES} labels={BREAK_TYPE_LABELS} value={breakType} onChange={setBreakType} />
      <Choice name="outcome" legend="What happened" options={BREAK_OUTCOMES} labels={BREAK_OUTCOME_LABELS} value={outcome} onChange={setOutcome} />
      <FormField name="minutes" label="Minutes you actually got (optional)" inputMode="numeric" error={err.minutes} />
      <Choice name="paid" legend="Was it paid?" options={BREAK_PAID} labels={BREAK_PAID_LABELS} value={paid} onChange={setPaid} />
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea
          id="notes"
          name="notes"
          maxLength={500}
          rows={2}
          placeholder="Who asked you to skip it, how busy it was…"
          className="w-full rounded-lg border bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {err.notes ? <p className="text-sm text-destructive">{err.notes}</p> : null}
      </div>
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      {state.status === "saved" ? (
        <p role="status" className="text-sm font-medium text-primary">
          Saved to your log.
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
        {pending ? "Saving…" : "Save break"}
      </Button>
    </form>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      aria-label="Delete entry"
      disabled={pending}
      onClick={() => startTransition(async () => void (await deleteBreak(id)))}
      className="flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}

export function BreakLog({ entries }: { entries: BreakLogEntry[] }) {
  return (
    <div className="space-y-6">
      <BreakForm />
      <section>
        <h2 className="mb-2 text-lg font-semibold">Your log</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium">
                    {dateFmt.format(new Date(`${e.shiftDate}T00:00:00Z`))} · {BREAK_TYPE_LABELS[e.breakType]}
                  </span>
                  <span className="block text-muted-foreground">
                    {BREAK_OUTCOME_LABELS[e.outcome]}
                    {e.minutes !== null ? ` · ${e.minutes} min` : ""} · {BREAK_PAID_LABELS[e.paid]}
                  </span>
                  {e.notes ? <span className="block text-muted-foreground">{e.notes}</span> : null}
                </span>
                <DeleteButton id={e.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        This log is private to you. It&apos;s your own record, not a complaint, and general information, not legal advice.
      </p>
    </div>
  );
}
