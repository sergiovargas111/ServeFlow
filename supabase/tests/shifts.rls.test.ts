import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createTestUser, deleteTestUser, hasTestDb, type TestUser } from "./helpers";

const shift = { shift_date: "2026-10-02", shift_type: "dinner", gross_tips: 185.5 };

describe.skipIf(!hasTestDb)("shifts RLS (integration)", () => {
  let alice: TestUser;
  let bob: TestUser;
  let bobShiftId: string;

  beforeAll(async () => {
    alice = await createTestUser("alice");
    bob = await createTestUser("bob");
    const { data, error } = await bob.client.from("shifts").insert(shift).select("id").single();
    if (error) throw error;
    bobShiftId = data.id;
  });

  afterAll(async () => {
    await deleteTestUser(alice);
    await deleteTestUser(bob);
  });

  it("lets a user insert and read their own shift (user_id defaults to them)", async () => {
    const { data, error } = await alice.client.from("shifts").insert(shift).select("user_id").single();
    expect(error).toBeNull();
    expect(data?.user_id).toBe(alice.id);
  });

  it("never shows another user's shifts", async () => {
    const { data } = await alice.client.from("shifts").select("id, user_id");
    expect(data?.every((r) => r.user_id === alice.id)).toBe(true);
    const { data: direct } = await alice.client.from("shifts").select("id").eq("id", bobShiftId);
    expect(direct).toEqual([]);
  });

  it("can't insert a shift as another user", async () => {
    const { error } = await alice.client.from("shifts").insert({ ...shift, user_id: bob.id });
    expect(error).not.toBeNull();
  });

  it("can't edit another user's tips", async () => {
    await alice.client.from("shifts").update({ gross_tips: 0 }).eq("id", bobShiftId);
    const { data } = await adminClient().from("shifts").select("gross_tips").eq("id", bobShiftId).single();
    expect(Number(data?.gross_tips)).toBe(185.5);
  });

  it("can't move their own shift to another user", async () => {
    const { data: own } = await alice.client.from("shifts").insert(shift).select("id").single();
    const { error } = await alice.client.from("shifts").update({ user_id: bob.id }).eq("id", own!.id);
    expect(error).not.toBeNull();
  });

  it("can't delete another user's shift", async () => {
    await alice.client.from("shifts").delete().eq("id", bobShiftId);
    const { data } = await adminClient().from("shifts").select("id").eq("id", bobShiftId);
    expect(data).toHaveLength(1);
  });

  it("gives logged-out clients nothing and blocks their inserts", async () => {
    const anon = anonClient();
    const { data } = await anon.from("shifts").select("id");
    expect(data ?? []).toEqual([]);
    const { error } = await anon.from("shifts").insert(shift);
    expect(error).not.toBeNull();
  });

  it.each([
    ["negative tips", { gross_tips: -5 }],
    ["absurd tips", { gross_tips: 50000 }],
    ["40-hour shift", { hours: 40 }],
    ["tip-out above total", { tip_out: 999 }],
    ["unknown shift type", { shift_type: "brunch" }],
    ["unknown tag", { tags: ["vip"] }],
    ["overlong notes", { notes: "x".repeat(501) }],
  ])("rejects %s at the database level", async (_label, patch) => {
    const { error } = await alice.client.from("shifts").insert({ ...shift, ...patch });
    expect(error).not.toBeNull();
  });

  it("stores SQL-injection and XSS text in notes verbatim", async () => {
    for (const notes of ["'; DROP TABLE shifts; --", "<script>alert(1)</script>"]) {
      const { data, error } = await alice.client.from("shifts").insert({ ...shift, notes }).select("notes").single();
      expect(error).toBeNull();
      expect(data?.notes).toBe(notes);
    }
  });

  it("rejects a duplicate clientId for the same user (offline retry)", async () => {
    const client_id = crypto.randomUUID();
    expect((await alice.client.from("shifts").insert({ ...shift, client_id })).error).toBeNull();
    expect((await alice.client.from("shifts").insert({ ...shift, client_id })).error?.code).toBe("23505");
  });

  it("deletes a user's shifts when the account is deleted", async () => {
    const temp = await createTestUser("temp");
    await temp.client.from("shifts").insert(shift);
    await deleteTestUser(temp);
    const { data } = await adminClient().from("shifts").select("id").eq("user_id", temp.id);
    expect(data).toEqual([]);
  });
});
