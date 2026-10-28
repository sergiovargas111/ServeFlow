import { describe, expect, it } from "vitest";
import { splitCents, splitTotal } from "./split";
import { SPLIT_BUCKETS } from "./types";

const sum = (parts: Record<string, number>) => Object.values(parts).reduce((a, b) => a + b, 0);

describe("splitCents", () => {
  it("splits an even amount exactly", () => {
    expect(splitCents(20_000, { bills: 50, savings: 10, spending: 25, taxes: 15 })).toEqual({
      bills: 10_000,
      savings: 2_000,
      spending: 5_000,
      taxes: 3_000,
    });
  });

  it("always adds back up to the exact amount", () => {
    const split = { bills: 33, savings: 33, spending: 33, taxes: 1 };
    for (const amount of [0, 1, 7, 99, 101, 18_551, 123_457]) {
      expect(sum(splitCents(amount, split))).toBe(amount);
    }
  });

  it("gives leftover cents to the largest remainders, then the first bucket", () => {
    // $1.00 three ways: 33.33 each → the extra cent goes to bills.
    expect(splitCents(100, { bills: 34, savings: 33, spending: 33, taxes: 0 })).toEqual({
      bills: 34,
      savings: 33,
      spending: 33,
      taxes: 0,
    });
    expect(splitCents(1, { bills: 25, savings: 25, spending: 25, taxes: 25 })).toEqual({
      bills: 1,
      savings: 0,
      spending: 0,
      taxes: 0,
    });
  });

  it("never puts money in a 0% bucket", () => {
    const parts = splitCents(9_999, { bills: 0, savings: 0, spending: 100, taxes: 0 });
    expect(parts).toEqual({ bills: 0, savings: 0, spending: 9_999, taxes: 0 });
  });

  it("returns zeros for zero or negative amounts", () => {
    for (const amount of [0, -500]) {
      expect(splitCents(amount, { bills: 50, savings: 10, spending: 25, taxes: 15 })).toEqual(
        Object.fromEntries(SPLIT_BUCKETS.map((b) => [b, 0])),
      );
    }
  });

  it("refuses a split that doesn't add up to 100", () => {
    expect(() => splitCents(100, { bills: 50, savings: 50, spending: 50, taxes: 0 })).toThrow();
  });
});

describe("splitTotal", () => {
  it("adds the bucket percentages", () => {
    expect(splitTotal({ bills: 50, savings: 10, spending: 25, taxes: 15 })).toBe(100);
  });
});
