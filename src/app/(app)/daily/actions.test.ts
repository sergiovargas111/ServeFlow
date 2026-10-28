import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { userId: "user-a" as string | null };
const upsert = vi.fn();
const match = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/server", () => ({
  getUserId: async () => state.userId,
  createClient: async () => ({ from: () => ({ upsert, delete: () => ({ match }) }) }),
}));

async function load() {
  vi.resetModules();
  return (await import("./actions")).setHabit;
}

const today = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  state.userId = "user-a";
  upsert.mockReset().mockResolvedValue({ error: null });
  match.mockReset().mockResolvedValue({ error: null });
});

describe("setHabit", () => {
  it("rejects unauthenticated calls", async () => {
    state.userId = null;
    const setHabit = await load();
    expect(await setHabit({ habitId: "memorize_menu", date: today, done: true })).toMatchObject({ status: "error" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("checks a habit off for the session user (idempotent)", async () => {
    const setHabit = await load();
    expect(await setHabit({ habitId: "memorize_menu", date: today, done: true, user_id: "user-b" })).toEqual({ status: "saved" });
    expect(upsert.mock.calls[0][0]).toEqual({ user_id: "user-a", task_id: "memorize_menu", completed_on: today });
    expect(upsert.mock.calls[0][1]).toMatchObject({ ignoreDuplicates: true });
  });

  it("unchecks a habit", async () => {
    const setHabit = await load();
    await setHabit({ habitId: "memorize_menu", date: today, done: false });
    expect(match).toHaveBeenCalledWith({ user_id: "user-a", task_id: "memorize_menu", completed_on: today });
  });

  it("rejects unknown habits, bad dates and dates far from today", async () => {
    const setHabit = await load();
    for (const input of [
      { habitId: "log_tips", date: today, done: true },
      { habitId: "memorize_menu", date: "2026-13-01", done: true },
      { habitId: "memorize_menu", date: "2020-01-01", done: true },
      { habitId: "memorize_menu", date: today, done: "yes" },
      null,
    ]) {
      expect((await setHabit(input)).status).toBe("error");
    }
    expect(upsert).not.toHaveBeenCalled();
  });
});
