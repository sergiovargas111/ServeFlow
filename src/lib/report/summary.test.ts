import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/shifts/dates";
import type { ShiftRecord, ShiftTag, ShiftType } from "@/lib/shifts/types";
import { buildTipReport } from "./summary";

const TODAY = "2026-10-04"; // Sunday

function shift(date: string, dollars: number, type: ShiftType = "dinner", tags: ShiftTag[] = []): ShiftRecord {
  return { date, shiftType: type, grossCents: dollars * 100, tipOutCents: 0, tags };
}

/** n consecutive weekly shifts ending on `last`. */
function weekly(last: string, amounts: number[], type: ShiftType = "dinner"): ShiftRecord[] {
  return amounts.map((a, i) => shift(addDays(last, -7 * (amounts.length - 1 - i)), a, type));
}

describe("buildTipReport", () => {
  it("handles a brand-new user with no shifts", () => {
    const r = buildTipReport([], TODAY);
    expect(r).toMatchObject({ shiftCount: 0, latest: null, averagePerShiftCents: null, projection: null, typical: [] });
    expect(r.weekly).toHaveLength(8);
    expect(r.monthly).toHaveLength(6);
  });

  it("prompts to unlock the forecast after a single shift", () => {
    const r = buildTipReport([shift("2026-10-02", 150)], TODAY);
    expect(r.latest?.forecast.status).toBe("locked");
    expect(r.latest?.message.headline).toBe("Log a few more shifts to unlock your forecast");
  });

  it("compares the latest shift with its typical range", () => {
    // Four $150 Friday dinners, then $172 on Oct 2 (+14.7%).
    const shifts = [...weekly("2026-09-25", [150, 150, 150, 150]), shift("2026-10-02", 172)];
    const r = buildTipReport(shifts, TODAY);
    expect(r.latest?.takeHomeCents).toBe(17200);
    expect(r.latest?.message).toMatchObject({ tone: "celebrate", headline: "+14.7% above your typical Friday dinner" });
  });

  it("uses neutral copy when the latest shift was slow", () => {
    const shifts = [...weekly("2026-09-25", [150, 150, 150, 150]), shift("2026-10-02", 90)];
    expect(buildTipReport(shifts, TODAY).latest?.message).toMatchObject({
      tone: "neutral",
      headline: "Slower than usual. Fridays vary.",
    });
  });

  it("ignores future-dated shifts when picking the latest", () => {
    const r = buildTipReport([shift("2026-10-02", 150), shift("2026-10-09", 999)], TODAY);
    expect(r.latest?.shift.date).toBe("2026-10-02");
    expect(r.shiftCount).toBe(1);
  });

  it("lists unlocked typical shifts, soonest first, with ranges", () => {
    const shifts = [
      ...weekly("2026-10-02", [140, 150, 160, 170]), // Fri dinner
      ...weekly("2026-09-29", [60, 70, 80, 90], "lunch"), // Tue lunch
      ...weekly("2026-10-03", [200, 210], "dinner"), // Sat dinner: only 2, still locked
    ];
    const r = buildTipReport(shifts, TODAY);
    expect(r.typical.map((t) => [t.label, t.range, t.nextDate])).toEqual([
      ["Tuesday lunch", "$68–$83", "2026-10-06"],
      ["Friday dinner", "$148–$163", "2026-10-09"],
    ]);
  });

  it("includes today's shift type in the typical list with today's date", () => {
    const shifts = weekly("2026-09-27", [100, 110, 120, 130]); // Sundays
    expect(buildTipReport(shifts, TODAY).typical[0]).toMatchObject({ label: "Sunday dinner", nextDate: TODAY });
  });

  it("keeps holidays out of the typical list", () => {
    const shifts = ["2025-12-25", "2026-01-01", "2026-05-25", "2026-07-04"].map((d) => shift(d, 400, "dinner", ["holiday"]));
    expect(buildTipReport(shifts, TODAY).typical).toEqual([]);
  });
});
