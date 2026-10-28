"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setState } from "@/app/(app)/rights/actions";
import { Label } from "@/components/ui/label";
import { COVERED_STATES, US_STATES } from "@/lib/labor/types";

export function StatePicker({ state }: { state: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onChange(value: string) {
    setError(null);
    startTransition(async () => {
      const r = await setState({ state: value });
      if (r.status === "error") setError(r.message);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="state">Where do you work?</Label>
      <select
        id="state"
        name="state"
        value={state ?? ""}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-lg border bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">Pick your state</option>
        <optgroup label="Verified so far">
          {COVERED_STATES.map((s) => (
            <option key={s} value={s}>
              {US_STATES[s]}
            </option>
          ))}
        </optgroup>
        <optgroup label="Federal rules only for now">
          {Object.entries(US_STATES)
            .filter(([s]) => !(COVERED_STATES as readonly string[]).includes(s))
            .map(([s, name]) => (
              <option key={s} value={s}>
                {name}
              </option>
            ))}
        </optgroup>
      </select>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
