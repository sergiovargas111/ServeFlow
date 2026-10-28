import { describe, expect, it } from "vitest";
import { computeStreak } from "./streak";

const TODAY = "2026-10-27";

describe("computeStreak", () => {
  it("is zero with no activity", () => {
    expect(computeStreak([], TODAY)).toEqual({ current: 0, best: 0, activeToday: false });
  });

  it("counts consecutive days ending today", () => {
    expect(computeStreak(["2026-10-25", "2026-10-26", "2026-10-27"], TODAY)).toEqual({ current: 3, best: 3, activeToday: true });
  });

  it("stays alive through yesterday when today isn't done yet", () => {
    expect(computeStreak(["2026-10-25", "2026-10-26"], TODAY)).toMatchObject({ current: 2, activeToday: false });
  });

  it("resets after a missed day", () => {
    expect(computeStreak(["2026-10-23", "2026-10-24", "2026-10-26"], TODAY)).toMatchObject({ current: 1, best: 2 });
    expect(computeStreak(["2026-10-24"], TODAY).current).toBe(0);
  });

  it("remembers the best run", () => {
    const days = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-10-27"];
    expect(computeStreak(days, TODAY)).toEqual({ current: 1, best: 4, activeToday: true });
  });

  it("counts a day once however many things were done", () => {
    expect(computeStreak(["2026-10-27", "2026-10-27", "2026-10-26"], TODAY).current).toBe(2);
  });

  it("ignores future dates", () => {
    expect(computeStreak(["2026-10-28", "2026-10-29"], TODAY)).toEqual({ current: 0, best: 0, activeToday: false });
  });

  it("works across month and year boundaries", () => {
    expect(computeStreak(["2025-12-30", "2025-12-31", "2026-01-01"], "2026-01-01").current).toBe(3);
  });
});
