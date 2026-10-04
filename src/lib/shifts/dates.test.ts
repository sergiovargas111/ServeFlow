import { describe, expect, it } from "vitest";
import { addDays, dayOfWeek, daysBetween, isValidIsoDate, localTodayIso, monthKey, startOfWeek } from "./dates";

describe("isValidIsoDate", () => {
  it.each(["2026-10-02", "2024-02-29", "2000-01-01"])("accepts %s", (d) => {
    expect(isValidIsoDate(d)).toBe(true);
  });

  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-1-2", "10/02/2026", "", "2026-10-02T00:00"])(
    "rejects %s",
    (d) => {
      expect(isValidIsoDate(d)).toBe(false);
    },
  );
});

describe("dayOfWeek", () => {
  it("returns 0-6 starting Sunday", () => {
    expect(dayOfWeek("2026-10-04")).toBe(0); // Sunday
    expect(dayOfWeek("2026-10-02")).toBe(5); // Friday
  });

  it("is unaffected by DST changes", () => {
    expect(dayOfWeek("2026-03-08")).toBe(0); // US DST starts
    expect(dayOfWeek("2026-11-01")).toBe(0); // US DST ends
  });
});

describe("date arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-10-01", "2026-10-08")).toBe(7);
    expect(daysBetween("2026-10-08", "2026-10-01")).toBe(-7);
  });

  it("finds the Monday that starts the week", () => {
    expect(startOfWeek("2026-10-02")).toBe("2026-09-28"); // Fri -> Mon
    expect(startOfWeek("2026-10-04")).toBe("2026-09-28"); // Sun belongs to the week before
    expect(startOfWeek("2026-09-28")).toBe("2026-09-28");
  });

  it("builds month keys", () => {
    expect(monthKey("2026-10-02")).toBe("2026-10");
  });
});

describe("localTodayIso", () => {
  it("uses the device's local calendar date, not UTC", () => {
    const lateNight = new Date(2026, 9, 2, 23, 30); // local Oct 2, 11:30pm
    expect(localTodayIso(lateNight)).toBe("2026-10-02");
  });
});
