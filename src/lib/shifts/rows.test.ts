import { describe, expect, it } from "vitest";
import { makeShiftSchema } from "@/lib/validation/shift";
import { rowsToRecords, rowToRecord, toInsertRow } from "./rows";

describe("rowToRecord", () => {
  it("maps numeric columns (number or string) to cents", () => {
    expect(
      rowToRecord({ shift_date: "2026-10-02", shift_type: "dinner", gross_tips: "185.50", tip_out: 12, tags: ["rainy"] }),
    ).toEqual({ date: "2026-10-02", shiftType: "dinner", grossCents: 18550, tipOutCents: 1200, tags: ["rainy"] });
  });

  it("defaults missing tip-out and tags", () => {
    expect(rowToRecord({ shift_date: "2026-10-02", shift_type: "lunch", gross_tips: 60, tip_out: null, tags: null })).toMatchObject({
      tipOutCents: 0,
      tags: [],
    });
  });

  it("drops rows with an unknown shift type and unknown tags", () => {
    const rows = [
      { shift_date: "2026-10-02", shift_type: "brunch", gross_tips: 60, tip_out: 0, tags: [] },
      { shift_date: "2026-10-03", shift_type: "dinner", gross_tips: 90, tip_out: 0, tags: ["vip", "holiday"] },
    ];
    const records = rowsToRecords(rows);
    expect(records).toHaveLength(1);
    expect(records[0].tags).toEqual(["holiday"]);
  });
});

describe("toInsertRow", () => {
  const schema = makeShiftSchema("2026-10-04");

  it("uses the session user id and converts cents back to dollars", () => {
    const shift = schema.parse({ shiftDate: "2026-10-02", shiftType: "dinner", grossTips: "185.50", tipOut: "12", hours: "6.5" });
    expect(toInsertRow(shift, "user-a")).toEqual({
      user_id: "user-a",
      shift_date: "2026-10-02",
      shift_type: "dinner",
      gross_tips: 185.5,
      cash_tips: null,
      card_tips: null,
      tip_out: 12,
      hours: 6.5,
      tables_count: null,
      tags: [],
      notes: null,
      client_id: null,
    });
  });

  it("defaults tip-out to zero", () => {
    const shift = schema.parse({ shiftDate: "2026-10-02", shiftType: "lunch", grossTips: "60" });
    expect(toInsertRow(shift, "u").tip_out).toBe(0);
  });
});
