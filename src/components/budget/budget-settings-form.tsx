"use client";

import { useActionState, useState } from "react";
import { saveBudgetSettings, type BudgetFormState } from "@/app/(app)/budget/settings/actions";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import {
  SPLIT_BUCKETS,
  SPLIT_LABELS,
  TIP_OUT_BASES,
  TIP_OUT_ROLE_LABELS,
  TIP_OUT_ROLES,
  type BudgetSettings,
  type TipOutBasis,
} from "@/lib/budget/types";
import { cn } from "@/lib/utils";

const initial: BudgetFormState = { status: "idle" };
const splitField = (b: string) => `split${b[0].toUpperCase()}${b.slice(1)}`;

function initialValues(settings: BudgetSettings): Record<string, string> {
  const v: Record<string, string> = {};
  for (const r of TIP_OUT_ROLES) {
    v[`${r}Pct`] = settings.tipOuts[r].bp ? String(settings.tipOuts[r].bp / 100) : "";
    v[`${r}Basis`] = settings.tipOuts[r].basis;
  }
  for (const b of SPLIT_BUCKETS) v[splitField(b)] = String(settings.split[b]);
  return v;
}

export function BudgetSettingsForm({ settings }: { settings: BudgetSettings }) {
  const [state, action, pending] = useActionState(saveBudgetSettings, initial);
  const values = state.values ?? initialValues(settings);
  const [bases, setBases] = useState<Record<string, TipOutBasis>>(() =>
    Object.fromEntries(TIP_OUT_ROLES.map((r) => [r, settings.tipOuts[r].basis])),
  );
  const [split, setSplit] = useState<Record<string, string>>(() =>
    Object.fromEntries(SPLIT_BUCKETS.map((b) => [b, values[splitField(b)] ?? ""])),
  );
  const splitSum = SPLIT_BUCKETS.reduce((sum, b) => sum + (Number(split[b]) || 0), 0);
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-6" noValidate>
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Tip-outs</legend>
        <p className="text-sm text-muted-foreground">
          What you pay support staff each shift. Leave the tip-out blank when you log a shift and it&apos;s worked out from
          these.
        </p>
        {TIP_OUT_ROLES.map((role) => (
          <div key={role} className="space-y-2">
            <FormField
              name={`${role}Pct`}
              label={`${TIP_OUT_ROLE_LABELS[role]} (%)`}
              inputMode="decimal"
              placeholder="0"
              defaultValue={values[`${role}Pct`]}
              error={err[`${role}Pct`]}
            />
            <input type="hidden" name={`${role}Basis`} value={bases[role]} />
            <div role="radiogroup" aria-label={`${TIP_OUT_ROLE_LABELS[role]} tip-out is a % of`} className="grid grid-cols-2 gap-2">
              {TIP_OUT_BASES.map((basis) => (
                <button
                  key={basis}
                  type="button"
                  role="radio"
                  aria-checked={bases[role] === basis}
                  onClick={() => setBases((b) => ({ ...b, [role]: basis }))}
                  className={cn(
                    "h-10 rounded-lg border text-sm",
                    bases[role] === basis ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted",
                  )}
                >
                  % of {basis}
                </button>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Split each night&apos;s take-home</legend>
        <div className="grid grid-cols-2 gap-3">
          {SPLIT_BUCKETS.map((b) => (
            <FormField
              key={b}
              name={splitField(b)}
              label={`${SPLIT_LABELS[b]} (%)`}
              inputMode="numeric"
              value={split[b]}
              onChange={(e) => setSplit((s) => ({ ...s, [b]: e.target.value }))}
              error={err[splitField(b)]}
            />
          ))}
        </div>
        <p aria-live="polite" className={cn("text-sm", splitSum === 100 ? "text-muted-foreground" : "font-medium")}>
          Adds up to {splitSum}%{splitSum === 100 ? "" : " (needs to be 100%)"}
        </p>
        <p className="text-xs text-muted-foreground">The taxes amount is a savings target you choose, not tax advice.</p>
      </fieldset>

      {state.status === "saved" ? (
        <p role="status" className="text-sm font-medium text-primary">
          Saved.
        </p>
      ) : null}
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-14 w-full text-lg" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
