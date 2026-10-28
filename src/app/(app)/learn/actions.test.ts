import { beforeEach, describe, expect, it, vi } from "vitest";
import { drillsForLevel, getDrill } from "@/lib/learn/content";
import { buildMenuQuiz } from "@/lib/learn/menu-quiz";

const state = {
  userId: "user-a" as string | null,
  attempts: [] as Record<string, unknown>[],
  menu: [] as Record<string, unknown>[],
  menuCount: 0,
};
const insert = vi.fn();
const deleteEq = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/server", () => ({
  getUserId: async () => state.userId,
  createClient: async () => ({
    from: (table: string) => ({
      select: (_cols: string, opts?: { head?: boolean }) =>
        opts?.head
          ? Promise.resolve({ count: state.menuCount, error: null })
          : { limit: async () => ({ data: table === "menu_items" ? state.menu : state.attempts, error: null }) },
      insert: (row: unknown) => insert(table, row),
      delete: () => ({ eq: (...a: unknown[]) => ({ eq: (...b: unknown[]) => deleteEq(...a, ...b) }) }),
    }),
  }),
}));

async function load() {
  vi.resetModules(); // fresh rate limiter
  return import("./actions");
}

const today = new Date().toISOString().slice(0, 10);
const greeting = getDrill("l1-greeting")!;
const rightAnswers = greeting.questions.map((q) => q.answer);

beforeEach(() => {
  state.userId = "user-a";
  state.attempts = [];
  state.menu = [];
  state.menuCount = 0;
  insert.mockReset().mockResolvedValue({ error: null });
  deleteEq.mockReset().mockResolvedValue({ error: null });
});

describe("submitDrill", () => {
  it("rejects unauthenticated calls", async () => {
    state.userId = null;
    const { submitDrill } = await load();
    expect(await submitDrill({ drillId: greeting.id, answers: rightAnswers, completedOn: today })).toMatchObject({
      status: "error",
      message: "Please sign in again.",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("grades on the server and saves the attempt under the session user", async () => {
    const { submitDrill } = await load();
    const r = await submitDrill({ drillId: greeting.id, answers: rightAnswers, completedOn: today });
    expect(r).toMatchObject({ status: "graded", score: 5, total: 5, passed: true });
    expect(insert).toHaveBeenCalledWith("drill_attempts", {
      user_id: "user-a",
      drill_id: greeting.id,
      score: 5,
      total: 5,
      completed_on: today,
    });
  });

  it("ignores a score sent by the client", async () => {
    const { submitDrill } = await load();
    await submitDrill({ drillId: greeting.id, answers: [], completedOn: today, score: 5, total: 5, user_id: "user-b" });
    expect(insert.mock.calls[0][1]).toMatchObject({ user_id: "user-a", score: 0, total: 5 });
  });

  it("blocks a level 2 drill until level 1 is passed", async () => {
    const { submitDrill } = await load();
    const r = await submitDrill({ drillId: "l2-drinks", answers: [0, 0, 0, 0, 0], completedOn: today });
    expect(r).toMatchObject({ status: "error" });
    expect(insert).not.toHaveBeenCalled();

    state.attempts = drillsForLevel(1).map((d) => ({ drill_id: d.id, score: 5, total: 5, completed_on: today }));
    expect((await submitDrill({ drillId: "l2-drinks", answers: [0, 0, 0, 0, 0], completedOn: today })).status).toBe("graded");
  });

  it("rejects unknown drills, bad answers and far-off dates", async () => {
    const { submitDrill } = await load();
    for (const input of [
      { drillId: "l1-nope", answers: [], completedOn: today },
      { drillId: "'; DROP TABLE drill_attempts; --", answers: [], completedOn: today },
      { drillId: greeting.id, answers: [1, 2, "x"], completedOn: today },
      { drillId: greeting.id, answers: [-1], completedOn: today },
      { drillId: greeting.id, answers: rightAnswers, completedOn: "2020-01-01" },
      { drillId: greeting.id, answers: rightAnswers, completedOn: "2026-02-30" },
      null,
      "drill",
    ]) {
      expect((await submitDrill(input)).status).toBe("error");
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it("grades a menu quiz by rebuilding it from the user's menu and the seed", async () => {
    state.menu = [
      { id: "a", name: "Calamari", description: "Fried squid", allergens: ["shellfish"] },
      { id: "b", name: "Caesar", description: "Romaine, parmesan", allergens: ["milk", "fish"] },
      { id: "c", name: "Ribeye", description: "14 oz steak", allergens: ["milk"] },
      { id: "d", name: "Pad Thai", description: "Rice noodles, peanuts", allergens: ["peanuts"] },
    ];
    const quiz = buildMenuQuiz(
      state.menu.map((m) => ({ ...m }) as never),
      "abc123",
    );
    const { submitDrill } = await load();
    const r = await submitDrill({ drillId: "menu", seed: "abc123", answers: quiz.map((q) => q.answer), completedOn: today });
    expect(r).toMatchObject({ status: "graded", score: quiz.length, passed: true });
  });

  it("refuses a menu quiz without a seed or with too few dishes", async () => {
    const { submitDrill } = await load();
    expect((await submitDrill({ drillId: "menu", answers: [], completedOn: today })).status).toBe("error");
    expect((await submitDrill({ drillId: "menu", seed: "abc", answers: [], completedOn: today })).status).toBe("error");
  });
});

describe("addMenuItem", () => {
  function form(values: Record<string, string | string[]>) {
    const f = new FormData();
    for (const [k, v] of Object.entries(values)) for (const x of [v].flat()) f.append(k, x);
    return f;
  }

  it("saves a valid dish with allergens", async () => {
    const { addMenuItem } = await load();
    const r = await addMenuItem({ status: "idle" }, form({ name: "  Ribeye ", description: "14 oz", allergens: ["milk", "soy"] }));
    expect(r.status).toBe("saved");
    expect(insert).toHaveBeenCalledWith("menu_items", { name: "Ribeye", description: "14 oz", allergens: ["milk", "soy"], user_id: "user-a" });
  });

  it("rejects an empty name, unknown allergens and overlong text", async () => {
    const { addMenuItem } = await load();
    expect((await addMenuItem({ status: "idle" }, form({ name: "   " }))).fieldErrors).toHaveProperty("name");
    expect((await addMenuItem({ status: "idle" }, form({ name: "A", allergens: "gluten" }))).fieldErrors).toHaveProperty("allergens");
    expect((await addMenuItem({ status: "idle" }, form({ name: "x".repeat(81) }))).fieldErrors).toHaveProperty("name");
    expect((await addMenuItem({ status: "idle" }, form({ name: "A", description: "x".repeat(201) }))).fieldErrors).toHaveProperty(
      "description",
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it("stores injection and script text as plain text", async () => {
    const { addMenuItem } = await load();
    await addMenuItem({ status: "idle" }, form({ name: "<script>alert(1)</script>", description: "'; DROP TABLE menu_items; --" }));
    expect(insert.mock.calls[0][1]).toMatchObject({ name: "<script>alert(1)</script>", description: "'; DROP TABLE menu_items; --" });
  });

  it("caps the menu size", async () => {
    state.menuCount = 150;
    const { addMenuItem } = await load();
    expect((await addMenuItem({ status: "idle" }, form({ name: "One more" }))).message).toMatch(/limited to 150/);
  });

  it("requires sign-in", async () => {
    state.userId = null;
    const { addMenuItem } = await load();
    expect((await addMenuItem({ status: "idle" }, form({ name: "Ribeye" }))).status).toBe("error");
  });
});

describe("deleteMenuItem", () => {
  it("deletes only by a valid id and only the session user's rows", async () => {
    const { deleteMenuItem } = await load();
    const id = "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60";
    expect(await deleteMenuItem(id)).toEqual({ ok: true });
    expect(deleteEq).toHaveBeenCalledWith("id", id, "user_id", "user-a");
    expect(await deleteMenuItem("1 OR 1=1")).toEqual({ ok: false });
  });
});
