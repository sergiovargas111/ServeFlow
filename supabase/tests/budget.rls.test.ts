import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createTestUser, deleteTestUser, hasTestDb, type TestUser } from "./helpers";

const settings = {
  bar_pct: 5,
  bar_basis: "tips",
  busser_pct: 1.5,
  busser_basis: "sales",
  split_bills: 50,
  split_savings: 10,
  split_spending: 25,
  split_taxes: 15,
};

describe.skipIf(!hasTestDb)("budget_settings RLS (integration)", () => {
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    alice = await createTestUser("alice");
    bob = await createTestUser("bob");
    const { error } = await bob.client.from("budget_settings").insert(settings);
    if (error) throw error;
  });

  afterAll(async () => {
    await deleteTestUser(alice);
    await deleteTestUser(bob);
  });

  it("lets a user save and read their own settings (user_id defaults to them)", async () => {
    const { data, error } = await alice.client.from("budget_settings").upsert(settings).select("user_id").single();
    expect(error).toBeNull();
    expect(data?.user_id).toBe(alice.id);
  });

  it("never shows another user's settings", async () => {
    const { data } = await alice.client.from("budget_settings").select("user_id");
    expect(data?.every((r) => r.user_id === alice.id)).toBe(true);
    const { data: direct } = await alice.client.from("budget_settings").select("user_id").eq("user_id", bob.id);
    expect(direct).toEqual([]);
  });

  it("can't write settings for another user", async () => {
    const { error } = await alice.client.from("budget_settings").insert({ ...settings, user_id: bob.id });
    expect(error).not.toBeNull();
    await alice.client.from("budget_settings").update({ split_bills: 0, split_spending: 75 }).eq("user_id", bob.id);
    const { data } = await adminClient().from("budget_settings").select("split_bills").eq("user_id", bob.id).single();
    expect(data?.split_bills).toBe(50);
  });

  it("can't delete another user's settings", async () => {
    await alice.client.from("budget_settings").delete().eq("user_id", bob.id);
    const { data } = await adminClient().from("budget_settings").select("user_id").eq("user_id", bob.id);
    expect(data).toHaveLength(1);
  });

  it("gives logged-out clients nothing and blocks their writes", async () => {
    const anon = anonClient();
    const { data } = await anon.from("budget_settings").select("user_id");
    expect(data ?? []).toEqual([]);
    expect((await anon.from("budget_settings").insert(settings)).error).not.toBeNull();
  });

  it.each([
    ["a 200% tip-out", { bar_pct: 200 }],
    ["tip-outs over 100% of tips", { bar_pct: 60, busser_pct: 50, busser_basis: "tips" }],
    ["a 25% tip-out on sales", { busser_pct: 25 }],
    ["a negative tip-out", { bar_pct: -1 }],
    ["an unknown basis", { bar_basis: "covers" }],
    ["a split over 100", { split_bills: 60 }],
    ["a negative split", { split_bills: -10, split_spending: 85 }],
  ])("rejects %s at the database level", async (_label, patch) => {
    const { error } = await alice.client.from("budget_settings").upsert({ ...settings, ...patch });
    expect(error).not.toBeNull();
  });

  it("rejects absurd sales on a shift", async () => {
    const { error } = await alice.client
      .from("shifts")
      .insert({ shift_date: "2026-10-02", shift_type: "dinner", gross_tips: 100, sales: 500000 });
    expect(error).not.toBeNull();
  });

  it("deletes a user's settings when the account is deleted", async () => {
    const temp = await createTestUser("temp");
    await temp.client.from("budget_settings").insert(settings);
    await deleteTestUser(temp);
    const { data } = await adminClient().from("budget_settings").select("user_id").eq("user_id", temp.id);
    expect(data).toEqual([]);
  });
});
