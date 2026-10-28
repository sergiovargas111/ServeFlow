import { describe, expect, it, vi } from "vitest";
import { DRILLS, drillsForLevel, getDrill, LEVELS, PLAYABLE_LEVELS } from "./content";

describe("drill content", () => {
  it("has unique drill ids in the l<level>-<name> format", () => {
    const ids = DRILLS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DRILLS) expect(d.id).toMatch(new RegExp(`^l${d.level}-[a-z-]+$`));
  });

  it.each(DRILLS.map((d) => [d.id, d] as const))("%s has 5 well-formed questions", (_id, drill) => {
    expect(drill.questions).toHaveLength(5);
    for (const q of drill.questions) {
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(Number.isInteger(q.answer)).toBe(true);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.choices.length);
      expect(q.why.length).toBeGreaterThan(10);
    }
  });

  it("has drills for every playable level and none for later levels", () => {
    for (const level of LEVELS) {
      expect(drillsForLevel(level.id).length > 0).toBe(PLAYABLE_LEVELS.includes(level.id));
    }
  });

  it("spreads the right answer across positions", () => {
    const counts = [0, 0, 0, 0];
    for (const d of DRILLS) for (const q of d.questions) counts[q.answer]++;
    // 40 questions: no position should hold more than half of the answers.
    for (const c of counts) expect(c).toBeLessThanOrEqual(20);
    expect(counts.filter((c) => c > 0).length).toBe(4);
  });

  it("keeps the same order every time (the server grades against it)", async () => {
    vi.resetModules();
    const again = (await import("./content")).DRILLS;
    expect(again).not.toBe(DRILLS);
    expect(again).toEqual(DRILLS);
  });

  it("finds drills by id", () => {
    expect(getDrill("l1-greeting")?.title).toBe("First impressions");
    expect(getDrill("nope")).toBeUndefined();
  });
});
