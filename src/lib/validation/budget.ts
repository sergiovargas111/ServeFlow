import { z } from "zod";
import {
  MAX_SALES_BP,
  MAX_TIPS_BP,
  SPLIT_BUCKETS,
  TIP_OUT_BASES,
  TIP_OUT_ROLE_LABELS,
  TIP_OUT_ROLES,
  type BudgetSettings,
} from "@/lib/budget/types";

const PERCENT = /^(\d{1,3})(?:\.(\d{1,2}))?$/;

/** "2.5" / "2.5%" → 250 basis points. Blank means 0. null for anything else. */
export function parsePercentToBp(input: string): number | null {
  const trimmed = input.trim().replace(/%$/, "").trim();
  if (trimmed === "") return 0;
  const m = PERCENT.exec(trimmed);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

const percent = (label: string) =>
  z.string({ error: `Enter ${label} as a number.` }).transform((v, ctx) => {
    const bp = parsePercentToBp(v);
    if (bp === null || bp > MAX_TIPS_BP) {
      ctx.addIssue({ code: "custom", message: `Enter ${label} like 3 or 2.5 (0 to 100).` });
      return z.NEVER;
    }
    return bp;
  });

const wholePercent = (label: string) =>
  z
    .string({ error: `Enter ${label} as a whole number.` })
    .regex(/^\s*\d{1,3}\s*$/, { error: `Enter ${label} as a whole number.` })
    .transform((v) => Number(v.trim()))
    .refine((n) => n <= 100, { error: `${label} can't be over 100%.` });

/** Validates the budget settings form. Every rule here is also a CHECK constraint in the database. */
export const budgetSettingsSchema = z
  .object({
    barPct: percent("the bar tip-out"),
    barBasis: z.enum(TIP_OUT_BASES, { error: "Pick tips or sales." }),
    busserPct: percent("the busser tip-out"),
    busserBasis: z.enum(TIP_OUT_BASES, { error: "Pick tips or sales." }),
    hostPct: percent("the host tip-out"),
    hostBasis: z.enum(TIP_OUT_BASES, { error: "Pick tips or sales." }),
    splitBills: wholePercent("Bills"),
    splitSavings: wholePercent("Savings"),
    splitSpending: wholePercent("Spending"),
    splitTaxes: wholePercent("Taxes"),
  })
  .superRefine((v, ctx) => {
    let tipsTotal = 0;
    for (const role of TIP_OUT_ROLES) {
      const bp = v[`${role}Pct`];
      if (v[`${role}Basis`] === "sales" && bp > MAX_SALES_BP) {
        ctx.addIssue({
          code: "custom",
          path: [`${role}Pct`],
          message: `${TIP_OUT_ROLE_LABELS[role]} tip-out on sales can be at most ${MAX_SALES_BP / 100}%.`,
        });
      }
      if (v[`${role}Basis`] === "tips") tipsTotal += bp;
    }
    if (tipsTotal > MAX_TIPS_BP) {
      ctx.addIssue({ code: "custom", path: ["barPct"], message: "Tip-outs can't add up to more than 100% of your tips." });
    }
    const total = v.splitBills + v.splitSavings + v.splitSpending + v.splitTaxes;
    if (total !== 100) {
      ctx.addIssue({ code: "custom", path: ["splitBills"], message: `The split adds up to ${total}%. Make it 100%.` });
    }
  })
  .transform(
    (v): BudgetSettings => ({
      tipOuts: {
        bar: { bp: v.barPct, basis: v.barBasis },
        busser: { bp: v.busserPct, basis: v.busserBasis },
        host: { bp: v.hostPct, basis: v.hostBasis },
      },
      split: { bills: v.splitBills, savings: v.splitSavings, spending: v.splitSpending, taxes: v.splitTaxes },
    }),
  );

export const BUDGET_FORM_FIELDS = [
  ...TIP_OUT_ROLES.flatMap((r) => [`${r}Pct`, `${r}Basis`] as const),
  ...SPLIT_BUCKETS.map((b) => `split${b[0].toUpperCase()}${b.slice(1)}` as `split${Capitalize<typeof b>}`),
] as const;
