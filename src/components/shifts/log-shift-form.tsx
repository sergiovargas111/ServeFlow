"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { logShift } from "@/app/(app)/log/actions";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeTipOut } from "@/lib/budget/tip-out";
import { hasTipOuts, needsSales, type BudgetSettings } from "@/lib/budget/types";
import { forecastFor } from "@/lib/forecast/engine";
import { getBrowserQueue } from "@/lib/shifts/browser-queue";
import { localTodayIso } from "@/lib/shifts/dates";
import { defaultShiftType } from "@/lib/shifts/defaults";
import { formatCents, MAX_SALES_CENTS, parseMoneyToCents } from "@/lib/shifts/money";
import {
  SHIFT_TAG_LABELS,
  SHIFT_TAGS,
  SHIFT_TYPE_LABELS,
  SHIFT_TYPES,
  type ShiftRecord,
  type ShiftTag,
  type ShiftType,
} from "@/lib/shifts/types";
import { cn } from "@/lib/utils";
import { ForecastPreview } from "./forecast-preview";

const noopSubscribe = () => () => {};

/**
 * Today's date and the lunch/dinner guess come from the phone's clock, which
 * the server can't know, so the form renders only on the client.
 */
export function LogShiftForm({ history, settings }: { history: ShiftRecord[]; settings: BudgetSettings }) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) return <div className="h-96 animate-pulse rounded-xl bg-muted" aria-hidden />;
  return <LogShiftFormInner history={history} settings={settings} />;
}

function LogShiftFormInner({ history, settings }: { history: ShiftRecord[]; settings: BudgetSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [shiftDate, setShiftDate] = useState(() => localTodayIso());
  const [shiftType, setShiftType] = useState<ShiftType>(() => defaultShiftType());
  const [grossTips, setGrossTips] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [cashTips, setCashTips] = useState("");
  const [cardTips, setCardTips] = useState("");
  const [tipOut, setTipOut] = useState("");
  const [sales, setSales] = useState("");
  const [hours, setHours] = useState("");
  const [tables, setTables] = useState("");
  const [tags, setTags] = useState<ShiftTag[]>([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);

  const forecast = useMemo(
    () => forecastFor(history, { date: shiftDate, shiftType, holiday: tags.includes("holiday") }),
    [history, shiftDate, shiftType, tags],
  );

  const gross = parseMoneyToCents(grossTips);
  const salesCents = sales.trim() === "" ? null : parseMoneyToCents(sales, MAX_SALES_CENTS);
  // A blank tip-out is filled in from the budget settings on the server; preview the same math here.
  const autoTipOut = gross === null || !hasTipOuts(settings) ? null : computeTipOut(settings, gross, salesCents);
  const out = tipOut.trim() === "" ? (autoTipOut?.totalCents ?? 0) : parseMoneyToCents(tipOut);
  const takeHome = gross === null || out === null ? null : Math.max(0, gross - out);

  function toggleTag(tag: ShiftTag) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clientId = crypto.randomUUID();
    const payload = { shiftDate, shiftType, grossTips, cashTips, cardTips, tipOut, sales, hours, tables, tags, notes, clientId };
    setMessage(null);
    setSavedOffline(false);

    const saveOnPhone = () => {
      const stored = getBrowserQueue().add({ clientId, queuedAt: new Date().toISOString(), payload });
      if (!stored) {
        setMessage("You're offline and this phone can't store the shift. Try again when you're back online.");
        return;
      }
      setSavedOffline(true);
      setGrossTips("");
      setErrors({});
    };

    if (!navigator.onLine) {
      saveOnPhone();
      return;
    }

    startTransition(async () => {
      let result;
      try {
        result = await logShift(payload);
      } catch {
        // The request never reached the server (bad Wi-Fi): keep the shift on the phone.
        saveOnPhone();
        return;
      }
      if (result.status === "saved") {
        router.push("/report?logged=1");
        return;
      }
      setErrors(result.fieldErrors ?? {});
      if (result.fieldErrors && Object.keys(result.fieldErrors).some((k) => !["shiftDate", "grossTips", "sales"].includes(k))) {
        setShowMore(true);
      }
      setMessage(result.message ?? null);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="grossTips" className="text-base">
          Total tips
        </Label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-3xl text-muted-foreground">
            $
          </span>
          <Input
            id="grossTips"
            name="grossTips"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            placeholder="0"
            value={grossTips}
            onChange={(e) => setGrossTips(e.target.value)}
            aria-invalid={errors.grossTips ? true : undefined}
            aria-describedby={errors.grossTips ? "grossTips-error" : undefined}
            className="h-16 pl-9 text-3xl font-semibold tabular-nums md:text-3xl"
          />
        </div>
        {errors.grossTips ? (
          <p id="grossTips-error" className="text-sm text-destructive">
            {errors.grossTips}
          </p>
        ) : null}
      </div>

      <fieldset className="space-y-1.5">
        <legend className="mb-1.5 text-sm font-medium">Shift</legend>
        <div role="radiogroup" aria-label="Shift type" className="grid grid-cols-3 gap-2">
          {SHIFT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={shiftType === type}
              onClick={() => setShiftType(type)}
              className={cn(
                "h-12 rounded-lg border text-base font-medium transition-colors",
                shiftType === type ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {SHIFT_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </fieldset>

      <FormField
        name="shiftDate"
        label="Date"
        type="date"
        value={shiftDate}
        max={localTodayIso()}
        onChange={(e) => setShiftDate(e.target.value)}
        error={errors.shiftDate}
      />

      {needsSales(settings) ? (
        <FormField
          name="sales"
          label="Sales (for tip-outs on sales)"
          inputMode="decimal"
          value={sales}
          onChange={(e) => setSales(e.target.value)}
          error={errors.sales}
          hint={autoTipOut?.missingSales ? "Add your sales so the tip-out on sales is counted." : undefined}
        />
      ) : null}

      <ForecastPreview forecast={forecast} takeHomeCents={takeHome} />

      {autoTipOut && tipOut.trim() === "" ? (
        <p className="text-sm text-muted-foreground">
          Tip-out {formatCents(autoTipOut.totalCents, { exact: true })} from your settings · take-home{" "}
          {formatCents(takeHome ?? 0, { exact: true })}
        </p>
      ) : null}

      <div>
        <button
          type="button"
          aria-expanded={showMore}
          onClick={() => setShowMore((s) => !s)}
          className="flex h-11 items-center gap-1 text-sm font-medium text-muted-foreground"
        >
          <ChevronDown className={cn("size-4 transition-transform", showMore && "rotate-180")} aria-hidden />
          More details (optional)
        </button>

        {showMore ? (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <FormField name="cashTips" label="Cash" inputMode="decimal" value={cashTips} onChange={(e) => setCashTips(e.target.value)} error={errors.cashTips} />
              <FormField name="cardTips" label="Card" inputMode="decimal" value={cardTips} onChange={(e) => setCardTips(e.target.value)} error={errors.cardTips} />
              <FormField
                name="tipOut"
                label="Tip-out paid"
                inputMode="decimal"
                placeholder={autoTipOut ? (autoTipOut.totalCents / 100).toFixed(2) : undefined}
                value={tipOut}
                onChange={(e) => setTipOut(e.target.value)}
                error={errors.tipOut}
              />
              <FormField name="hours" label="Hours" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} error={errors.hours} />
              <FormField name="tables" label="Tables in section" inputMode="numeric" value={tables} onChange={(e) => setTables(e.target.value)} error={errors.tables} />
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">What was the night like?</legend>
              <div className="flex flex-wrap gap-2">
                {SHIFT_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={tags.includes(tag)}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "h-10 rounded-full border px-4 text-sm",
                      tags.includes(tag) ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                    )}
                  >
                    {SHIFT_TAG_LABELS[tag]}
                  </button>
                ))}
              </div>
              {errors.tags ? <p className="pt-1 text-sm text-destructive">{errors.tags}</p> : null}
            </fieldset>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                maxLength={500}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              {errors.notes ? <p className="text-sm text-destructive">{errors.notes}</p> : null}
            </div>
          </div>
        ) : null}
      </div>

      {savedOffline ? (
        <p role="status" className="text-sm font-medium text-primary">
          Saved on this phone. It&apos;ll sync when you&apos;re back online.
        </p>
      ) : null}

      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-14 w-full text-lg" disabled={pending}>
        {pending ? "Saving…" : "Save shift"}
      </Button>
    </form>
  );
}
