import { describe, expect, it } from "vitest";
import { centsToDollars, dollarsToCents, formatCents, MAX_AMOUNT_CENTS, parseMoneyToCents } from "./money";

describe("parseMoneyToCents", () => {
  it.each([
    ["85", 8500],
    ["85.5", 8550],
    ["85.50", 8550],
    ["$85.50", 8550],
    ["  120 ", 12000],
    ["0", 0],
    ["0.01", 1],
    ["10000", MAX_AMOUNT_CENTS],
  ])("parses %s as %i cents", (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents);
  });

  it.each([
    ["negative", "-5"],
    ["letters", "abc"],
    ["mixed letters", "12abc"],
    ["too many decimals", "12.345"],
    ["absurdly large", "10000.01"],
    ["way too large", "99999999"],
    ["comma", "1,200"],
    ["empty", ""],
    ["just a dot", "."],
    ["trailing dot", "12."],
    ["scientific notation", "1e5"],
    ["SQL injection", "'; DROP TABLE shifts; --"],
  ])("rejects %s", (_label, input) => {
    expect(parseMoneyToCents(input)).toBeNull();
  });

  it("keeps sums exact where floats would drift", () => {
    expect(parseMoneyToCents("0.10")! + parseMoneyToCents("0.20")!).toBe(30);
  });
});

describe("cents conversions", () => {
  it("round-trips dollars and cents", () => {
    expect(centsToDollars(8550)).toBe(85.5);
    expect(dollarsToCents(85.5)).toBe(8550);
    expect(dollarsToCents("85.50")).toBe(8550);
    expect(dollarsToCents(0.29)).toBe(29);
  });
});

describe("formatCents", () => {
  it("formats rounded and exact dollars", () => {
    expect(formatCents(123450)).toBe("$1,235");
    expect(formatCents(123450, { exact: true })).toBe("$1,234.50");
    expect(formatCents(0)).toBe("$0");
  });
});
