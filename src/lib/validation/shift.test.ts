import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SHIFT_TAGS } from "@/lib/shifts/types";
import { makeShiftSchema } from "./shift";

const TODAY = "2026-10-04";
const schema = makeShiftSchema(TODAY);
const base = { shiftDate: "2026-10-02", shiftType: "dinner", grossTips: "185.50" };

function errorsFor(input: Record<string, unknown>) {
  const result = schema.safeParse({ ...base, ...input });
  return result.success ? [] : result.error.issues.map((i) => String(i.path[0]));
}

describe("shift schema: valid input", () => {
  it("accepts the minimal fast-log fields and converts money to cents", () => {
    const shift = schema.parse(base);
    expect(shift).toMatchObject({ shiftDate: "2026-10-02", shiftType: "dinner", grossTips: 18550, tags: [] });
    expect(shift.tipOut).toBeUndefined();
  });

  it("accepts every optional field", () => {
    const shift = schema.parse({
      ...base,
      cashTips: "85.50",
      cardTips: "100",
      tipOut: "12",
      hours: "6.5",
      tables: "5",
      tags: ["rainy", "holiday"],
      notes: "  Big party at 7  ",
      clientId: "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60",
    });
    expect(shift).toMatchObject({ cashTips: 8550, cardTips: 10000, tipOut: 1200, hours: 6.5, tables: 5 });
    expect(shift.notes).toBe("Big party at 7");
  });

  it("treats blank optional fields as not provided", () => {
    const shift = schema.parse({ ...base, tipOut: "", hours: "  ", tables: "", notes: "", clientId: "" });
    expect(shift.tipOut).toBeUndefined();
    expect(shift.hours).toBeUndefined();
    expect(shift.notes).toBeUndefined();
  });

  it("accepts zero tips (a slow night is still worth logging)", () => {
    expect(schema.safeParse({ ...base, grossTips: "0" }).success).toBe(true);
  });

  it("accepts tomorrow (server day can lag the user's)", () => {
    expect(schema.safeParse({ ...base, shiftDate: "2026-10-05" }).success).toBe(true);
  });
});

describe("shift schema: sales", () => {
  it("accepts sales above the $10,000 tip cap", () => {
    expect(schema.parse({ ...base, sales: "12500" }).sales).toBe(1_250_000);
  });

  it("treats blank sales as not given", () => {
    expect(schema.parse({ ...base, sales: "  " }).sales).toBeUndefined();
  });
});

describe("shift schema: rejects bad input", () => {
  it.each([
    ["negative tips", { grossTips: "-20" }, "grossTips"],
    ["letters in tips", { grossTips: "lots" }, "grossTips"],
    ["absurd tips", { grossTips: "50000" }, "grossTips"],
    ["too many decimals", { grossTips: "12.345" }, "grossTips"],
    ["missing tips", { grossTips: undefined }, "grossTips"],
    ["number instead of string", { grossTips: 185.5 }, "grossTips"],
    ["negative sales", { sales: "-100" }, "sales"],
    ["absurd sales", { sales: "250000" }, "sales"],
    ["40-hour shift", { hours: "40" }, "hours"],
    ["zero hours", { hours: "0" }, "hours"],
    ["negative hours", { hours: "-3" }, "hours"],
    ["200 tables", { tables: "200" }, "tables"],
    ["fractional tables", { tables: "2.5" }, "tables"],
    ["unknown shift type", { shiftType: "brunch" }, "shiftType"],
    ["invalid date", { shiftDate: "2026-02-30" }, "shiftDate"],
    ["future date", { shiftDate: "2026-10-10" }, "shiftDate"],
    ["ancient date", { shiftDate: "1999-12-31" }, "shiftDate"],
    ["unknown tag", { tags: ["vip"] }, "tags"],
    ["duplicate tags", { tags: ["rainy", "rainy"] }, "tags"],
    ["overlong notes", { notes: "x".repeat(501) }, "notes"],
    ["bad client id", { clientId: "not-a-uuid" }, "clientId"],
    ["tip-out above total", { tipOut: "200" }, "tipOut"],
    ["200% tip-out", { grossTips: "100", tipOut: "200" }, "tipOut"],
    ["cash + card not matching total", { cashTips: "50", cardTips: "50" }, "cashTips"],
    ["cash above total", { cashTips: "500" }, "cashTips"],
    ["SQL injection in tips", { grossTips: "'; DROP TABLE shifts; --" }, "grossTips"],
  ])("rejects %s", (_label, input, field) => {
    expect(errorsFor(input)).toContain(field);
  });
});

describe("shift schema: injection-safe free text", () => {
  it("keeps SQL and XSS payloads in notes as plain text", () => {
    for (const notes of ["'; DROP TABLE shifts; --", "<script>alert(1)</script>"]) {
      expect(schema.parse({ ...base, notes }).notes).toBe(notes);
    }
  });

  it("strips NUL bytes that Postgres text can't store", () => {
    expect(schema.parse({ ...base, notes: "a\u0000b" }).notes).toBe("ab");
  });
});

describe("shift tags", () => {
  it("match the database's allowed list", () => {
    const dir = join(__dirname, "../../../supabase/migrations");
    const file = readdirSync(dir).find((f) => f.endsWith("_shifts.sql"))!;
    const sql = readFileSync(join(dir, file), "utf8");
    const list = sql.match(/tags <@ array\[([^\]]*)\]/)![1];
    const dbTags = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(dbTags.sort()).toEqual([...SHIFT_TAGS].sort());
  });
});
