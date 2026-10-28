import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createTestUser, deleteTestUser, hasTestDb, type TestUser } from "./helpers";

const attempt = { drill_id: "l1-greeting", score: 4, total: 5, completed_on: "2026-10-27" };
const habit = { task_id: "memorize_menu", completed_on: "2026-10-27" };
const dish = { name: "Ribeye", description: "14 oz steak", allergens: ["milk"] };

describe.skipIf(!hasTestDb)("drill_attempts, task_completions, menu_items RLS (integration)", () => {
  let alice: TestUser;
  let bob: TestUser;
  let bobDishId: string;

  beforeAll(async () => {
    alice = await createTestUser("alice");
    bob = await createTestUser("bob");
    await bob.client.from("drill_attempts").insert(attempt);
    await bob.client.from("task_completions").insert(habit);
    const { data, error } = await bob.client.from("menu_items").insert(dish).select("id").single();
    if (error) throw error;
    bobDishId = data.id;
  });

  afterAll(async () => {
    await deleteTestUser(alice);
    await deleteTestUser(bob);
  });

  it.each(["drill_attempts", "task_completions", "menu_items"])("never shows another user's %s", async (table) => {
    const { data, error } = await alice.client.from(table).select("user_id");
    expect(error).toBeNull();
    expect(data?.every((r) => r.user_id === alice.id)).toBe(true);
  });

  it.each([
    ["drill_attempts", attempt],
    ["task_completions", habit],
    ["menu_items", dish],
  ] as [string, Record<string, unknown>][])("can't insert %s as another user", async (table, row) => {
    const { error } = await alice.client.from(table).insert({ ...row, user_id: bob.id });
    expect(error).not.toBeNull();
  });

  it("can't edit or delete another user's dish", async () => {
    await alice.client.from("menu_items").update({ name: "Hacked" }).eq("id", bobDishId);
    await alice.client.from("menu_items").delete().eq("id", bobDishId);
    const { data } = await adminClient().from("menu_items").select("name").eq("id", bobDishId).single();
    expect(data?.name).toBe("Ribeye");
  });

  it("doesn't allow editing a drill score after the fact", async () => {
    const { data } = await alice.client.from("drill_attempts").insert(attempt).select("id").single();
    await alice.client.from("drill_attempts").update({ score: 5 }).eq("id", data!.id);
    const { data: after } = await adminClient().from("drill_attempts").select("score").eq("id", data!.id).single();
    expect(after?.score).toBe(4);
  });

  it("gives logged-out clients nothing", async () => {
    const anon = anonClient();
    for (const table of ["drill_attempts", "task_completions", "menu_items"]) {
      const { data } = await anon.from(table).select("user_id");
      expect(data ?? []).toEqual([]);
    }
    expect((await anon.from("menu_items").insert(dish)).error).not.toBeNull();
  });

  it.each([
    ["drill_attempts", { ...attempt, score: 6 }],
    ["drill_attempts", { ...attempt, total: 0, score: 0 }],
    ["drill_attempts", { ...attempt, drill_id: "'; DROP TABLE x; --" }],
    ["task_completions", { ...habit, task_id: "log_tips" }],
    ["menu_items", { ...dish, name: "" }],
    ["menu_items", { ...dish, name: "x".repeat(81) }],
    ["menu_items", { ...dish, allergens: ["gluten"] }],
  ] as [string, Record<string, unknown>][])("rejects bad %s rows at the database level", async (table, row) => {
    const { error } = await alice.client.from(table).insert(row);
    expect(error).not.toBeNull();
  });

  it("stores script text in a dish name verbatim", async () => {
    const name = "<script>alert(1)</script>";
    const { data, error } = await alice.client.from("menu_items").insert({ ...dish, name }).select("name").single();
    expect(error).toBeNull();
    expect(data?.name).toBe(name);
  });

  it("removes all of it when the account is deleted", async () => {
    const temp = await createTestUser("temp");
    await temp.client.from("drill_attempts").insert(attempt);
    await temp.client.from("task_completions").insert(habit);
    await temp.client.from("menu_items").insert(dish);
    await deleteTestUser(temp);
    for (const table of ["drill_attempts", "task_completions", "menu_items"]) {
      const { data } = await adminClient().from(table).select("user_id").eq("user_id", temp.id);
      expect(data).toEqual([]);
    }
  });
});
