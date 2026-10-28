import { SPLIT_BUCKETS, type Split, type SplitBucket } from "./types";

export type SplitAmounts = Record<SplitBucket, number>;

export function splitTotal(split: Split): number {
  return SPLIT_BUCKETS.reduce((sum, b) => sum + split[b], 0);
}

/**
 * Divides an amount across the buckets by percentage so the parts always add
 * up to the exact amount (largest-remainder rounding; ties go to the bucket
 * listed first). `split` must add up to 100.
 */
export function splitCents(amountCents: number, split: Split): SplitAmounts {
  if (splitTotal(split) !== 100) throw new Error("split must add up to 100");
  const amount = Math.max(0, Math.round(amountCents));

  const parts = SPLIT_BUCKETS.map((bucket, order) => {
    const exact = amount * split[bucket];
    return { bucket, order, cents: Math.floor(exact / 100), remainder: exact % 100 };
  });

  let leftover = amount - parts.reduce((sum, p) => sum + p.cents, 0);
  const byRemainder = [...parts].sort((a, b) => b.remainder - a.remainder || a.order - b.order);
  for (const p of byRemainder) {
    if (leftover === 0) break;
    if (split[p.bucket] === 0) continue;
    p.cents += 1;
    leftover -= 1;
  }

  return Object.fromEntries(parts.map((p) => [p.bucket, p.cents])) as SplitAmounts;
}
