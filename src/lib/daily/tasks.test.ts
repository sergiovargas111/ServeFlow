import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDrill } from "@/lib/learn/content";
import { dayOfYear } from "./dates";
import { dailyTasks, HABIT_IDS, habitFor } from "./tasks";

const drill = getDrill("l1-greeting")!;
const none = { shiftLogged: false, drillDone: false, habitsDone: new Set<string>(), drill };

describe("dailyTasks", () => {
  it("gives three tasks: log tips, a drill and a habit", () => {
    const tasks = dailyTasks("2026-10-27", none);
    expect(tasks.map((t) => t.kind)).toEqual(["log", "drill", "habit"]);
    expect(tasks.every((t) => !t.done)).toBe(true);
    expect(tasks[1]).toMatchObject({ title: "Drill: First impressions", drillId: "l1-greeting" });
  });

  it("marks tasks done from logged shifts, drills and checked habits", () => {
    const habit = habitFor("2026-10-27");
    const tasks = dailyTasks("2026-10-27", { ...none, shiftLogged: true, drillDone: true, habitsDone: new Set([habit.id]) });
    expect(tasks.every((t) => t.done)).toBe(true);
  });

  it("only counts the habit of the day", () => {
    const other = HABIT_IDS.find((id) => id !== habitFor("2026-10-27").id)!;
    expect(dailyTasks("2026-10-27", { ...none, habitsDone: new Set([other]) })[2].done).toBe(false);
  });

  it("says a slow night still counts, and never shames a day off", () => {
    const log = dailyTasks("2026-10-27", none)[0];
    expect(log.detail).toMatch(/slow ones too/);
    expect(log.detail).not.toMatch(/fail|missed|bad/i);
  });

  it("rotates the habit day by day", () => {
    const habits = new Set(Array.from({ length: 5 }, (_, i) => habitFor(`2026-10-${20 + i}`).id));
    expect(habits.size).toBe(5);
  });
});

describe("dayOfYear", () => {
  it("counts from Jan 1", () => {
    expect(dayOfYear("2026-01-01")).toBe(0);
    expect(dayOfYear("2026-12-31")).toBe(364);
    expect(dayOfYear("2028-12-31")).toBe(365);
  });
});

describe("habit ids", () => {
  it("match the task_completions check constraint in the migrations", () => {
    const dir = join(__dirname, "../../../supabase/migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
    const m = /task_completions_task_id check \(task_id in \(([^)]*)\)\)/.exec(sql);
    expect(m).not.toBeNull();
    const ids = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    expect(ids.sort()).toEqual([...HABIT_IDS].sort());
  });
});
