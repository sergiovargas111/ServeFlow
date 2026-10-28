import { describe, expect, it } from "vitest";
import { budgetSettingsSchema, parsePercentToBp } from "./budget";

const valid = {
  barPct: "5",
  barBasis: "tips",
  busserPct: "1.5",
  busserBasis: "sales",
  hostPct: "",
  hostBasis: "tips",
  splitBills: "50",
  splitSavings: "10",
  splitSpending: "25",
  splitTaxes: "15",
};

function errorsFor(input: Record<string, unknown>) {
  const r = budgetSettingsSchema.safeParse(input);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]));
}

describe("parsePercentToBp", () => {
  it("reads whole and decimal percentages", () => {
    expect(parsePercentToBp("5")).toBe(500);
    expect(parsePercentToBp("2.5")).toBe(250);
    expect(parsePercentToBp("2.55")).toBe(255);
    expect(parsePercentToBp(" 3% ")).toBe(300);
    expect(parsePercentToBp("100")).toBe(10_000);
  });

  it("treats blank as 0", () => {
    expect(parsePercentToBp("")).toBe(0);
    expect(parsePercentToBp("   ")).toBe(0);
  });

  it("rejects negatives, letters, too many decimals and huge numbers", () => {
    for (const bad of ["-5", "five", "2.555", "1e2", "1000", "5,5", "NaN"]) expect(parsePercentToBp(bad)).toBeNull();
  });
});

describe("budgetSettingsSchema", () => {
  it("accepts a valid form and converts it to settings", () => {
    const r = budgetSettingsSchema.parse(valid);
    expect(r).toEqual({
      tipOuts: {
        bar: { bp: 500, basis: "tips" },
        busser: { bp: 150, basis: "sales" },
        host: { bp: 0, basis: "tips" },
      },
      split: { bills: 50, savings: 10, spending: 25, taxes: 15 },
    });
  });

  it("rejects a 200% tip-out", () => {
    expect(errorsFor({ ...valid, barPct: "200" })).toHaveProperty("barPct");
  });

  it("rejects tip-outs adding up to more than 100% of tips", () => {
    expect(errorsFor({ ...valid, barPct: "60", hostPct: "50" })).toEqual({
      barPct: "Tip-outs can't add up to more than 100% of your tips.",
    });
  });

  it("allows big tip-based percentages when other roles are on sales", () => {
    expect(budgetSettingsSchema.safeParse({ ...valid, barPct: "90", busserPct: "10", busserBasis: "sales" }).success).toBe(
      true,
    );
  });

  it("caps a tip-out on sales at 20%", () => {
    expect(errorsFor({ ...valid, busserPct: "25" })).toHaveProperty("busserPct");
    expect(budgetSettingsSchema.safeParse({ ...valid, busserPct: "20" }).success).toBe(true);
  });

  it("rejects a negative or non-numeric tip-out", () => {
    expect(errorsFor({ ...valid, barPct: "-3" })).toHaveProperty("barPct");
    expect(errorsFor({ ...valid, barPct: "'; DROP TABLE shifts; --" })).toHaveProperty("barPct");
  });

  it("rejects an unknown basis", () => {
    expect(errorsFor({ ...valid, barBasis: "covers" })).toHaveProperty("barBasis");
  });

  it("requires the split to add up to 100", () => {
    expect(errorsFor({ ...valid, splitBills: "60" })).toEqual({ splitBills: "The split adds up to 110%. Make it 100%." });
  });

  it("rejects decimal, negative or over-100 split values", () => {
    expect(errorsFor({ ...valid, splitBills: "49.5" })).toHaveProperty("splitBills");
    expect(errorsFor({ ...valid, splitSavings: "-10" })).toHaveProperty("splitSavings");
    expect(errorsFor({ ...valid, splitTaxes: "150" })).toHaveProperty("splitTaxes");
  });

  it("rejects missing fields and non-object input", () => {
    expect(budgetSettingsSchema.safeParse({}).success).toBe(false);
    for (const input of [null, "x", 42, []]) expect(budgetSettingsSchema.safeParse(input).success).toBe(false);
  });
});
