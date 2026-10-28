import { describe, expect, it } from "vitest";
import { DRILLS, drillsForLevel, getDrill } from "./content";
import { grade, isDrillUnlocked, isPassing, levelProgress, passedDrillIds, suggestedDrill, type Attempt } from "./progress";

const TODAY = "2026-10-27";
const pass = (drillId: string, completedOn = TODAY): Attempt => ({ drillId, score: 5, total: 5, completedOn });
const fail = (drillId: string): Attempt => ({ drillId, score: 2, total: 5, completedOn: TODAY });
const level1 = drillsForLevel(1).map((d) => pass(d.id));

describe("grade", () => {
  const drill = getDrill("l1-greeting")!;
  const right = drill.questions.map((q) => q.answer);

  it("scores all-correct answers as passed", () => {
    expect(grade(drill.questions, right)).toMatchObject({ score: 5, total: 5, passed: true });
  });

  it("passes at exactly 80%", () => {
    const one_wrong = [...right];
    one_wrong[0] = (right[0] + 1) % drill.questions[0].choices.length;
    const g = grade(drill.questions, one_wrong);
    expect(g).toMatchObject({ score: 4, passed: true });
    expect(g.results[0]).toBe(false);
  });

  it("treats missing, out-of-range and non-integer answers as wrong", () => {
    expect(grade(drill.questions, []).score).toBe(0);
    expect(grade(drill.questions, [99, -1, "1", 1.5, null]).score).toBe(0);
  });

  it("ignores extra answers", () => {
    expect(grade(drill.questions, [...right, 0, 0, 0]).score).toBe(5);
  });
});

describe("isPassing", () => {
  it("needs 80% and at least one question", () => {
    expect(isPassing(4, 5)).toBe(true);
    expect(isPassing(3, 5)).toBe(false);
    expect(isPassing(0, 0)).toBe(false);
  });
});

describe("levelProgress", () => {
  it("opens only level 1 for a new user", () => {
    const levels = levelProgress([]);
    expect(levels.map((l) => [l.id, l.unlocked])).toEqual([
      [1, true],
      [2, false],
      [3, false],
      [4, false],
    ]);
    expect(levels[0]).toMatchObject({ passed: 0, total: 4, complete: false });
  });

  it("counts a drill once even if passed many times, and ignores failed attempts", () => {
    const l = levelProgress([pass("l1-greeting"), pass("l1-greeting"), fail("l1-steps")])[0];
    expect(l.passed).toBe(1);
  });

  it("unlocks level 2 when every level 1 drill is passed", () => {
    const levels = levelProgress(level1);
    expect(levels[0].complete).toBe(true);
    expect(levels[1].unlocked).toBe(true);
  });

  it("keeps levels without drills locked as coming later", () => {
    const all = DRILLS.map((d) => pass(d.id));
    const levels = levelProgress(all);
    expect(levels[2]).toMatchObject({ playable: false, unlocked: false, total: 0 });
  });
});

describe("isDrillUnlocked", () => {
  it("blocks a level 2 drill until level 1 is done", () => {
    const drill = getDrill("l2-drinks")!;
    expect(isDrillUnlocked(drill, [])).toBe(false);
    expect(isDrillUnlocked(drill, level1)).toBe(true);
  });
});

describe("suggestedDrill", () => {
  it("starts a new user on the first level 1 drill", () => {
    expect(suggestedDrill([], TODAY).id).toBe("l1-greeting");
  });

  it("moves on to the next drill not yet passed", () => {
    expect(suggestedDrill([pass("l1-greeting")], TODAY).id).toBe("l1-steps");
    expect(suggestedDrill(level1, TODAY).id).toBe("l2-suggestive");
  });

  it("rotates review drills once everything is passed", () => {
    const all = DRILLS.map((d) => pass(d.id));
    const a = suggestedDrill(all, "2026-10-27").id;
    const b = suggestedDrill(all, "2026-10-28").id;
    expect(a).not.toBe(b);
    expect(passedDrillIds(all).has(a)).toBe(true);
  });
});
