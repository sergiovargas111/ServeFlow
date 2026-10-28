import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createTestUser, deleteTestUser, hasTestDb, type TestUser } from "./helpers";

const rule = {
  id: "zz-meal_break",
  jurisdiction: "ZZ",
  topic: "meal_break",
  answer: "depends",
  plain_english: "Test rule for RLS integration tests only.",
  legal_basis: "Test basis",
  source_url: "https://www.dol.gov/test",
  last_verified_at: "2026-10-27",
  reviewed_by: "test",
  status: "published",
};
const draft = { ...rule, id: "zz-rest_break", topic: "rest_break", status: "draft" };
const breakLog = { shift_date: "2026-10-27", break_type: "meal", outcome: "missed", paid: "unsure" };

describe.skipIf(!hasTestDb)("labor_rules and break_logs RLS (integration)", () => {
  let alice: TestUser;
  let bob: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    alice = await createTestUser("alice");
    bob = await createTestUser("bob");
    admin = await createTestUser("admin");
    await adminClient().auth.admin.updateUserById(admin.id, { app_metadata: { role: "admin" } });
    // Sign in again so the JWT carries the new app_metadata.
    await admin.client.auth.refreshSession();
    const { error } = await adminClient().from("labor_rules").upsert([rule, draft]);
    if (error) throw error;
    await bob.client.from("break_logs").insert(breakLog);
  });

  afterAll(async () => {
    await adminClient().from("labor_rules").delete().in("id", [rule.id, draft.id]);
    await deleteTestUser(alice);
    await deleteTestUser(bob);
    await deleteTestUser(admin);
  });

  it("lets signed-in users read published rules but not drafts", async () => {
    const { data } = await alice.client.from("labor_rules").select("id").in("id", [rule.id, draft.id]);
    expect(data?.map((r) => r.id)).toEqual([rule.id]);
  });

  it("gives logged-out clients no rules", async () => {
    const { data } = await anonClient().from("labor_rules").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("blocks normal users from inserting, editing or deleting rules", async () => {
    expect((await alice.client.from("labor_rules").insert({ ...rule, id: "zz-tip_pool", topic: "tip_pool" })).error).not.toBeNull();
    await alice.client.from("labor_rules").update({ answer: "yes" }).eq("id", rule.id);
    await alice.client.from("labor_rules").delete().eq("id", rule.id);
    const { data } = await adminClient().from("labor_rules").select("answer").eq("id", rule.id).single();
    expect(data?.answer).toBe("depends");
  });

  it("can't make yourself an admin by editing your profile", async () => {
    await alice.client.from("profiles").update({ role: "admin" } as never).eq("id", alice.id);
    await alice.client.auth.refreshSession();
    await alice.client.from("labor_rules").update({ answer: "yes" }).eq("id", rule.id);
    const { data } = await adminClient().from("labor_rules").select("answer").eq("id", rule.id).single();
    expect(data?.answer).toBe("depends");
  });

  it("lets an admin see drafts and update rules", async () => {
    const { data } = await admin.client.from("labor_rules").select("id").in("id", [rule.id, draft.id]);
    expect(data).toHaveLength(2);
    const { error } = await admin.client.from("labor_rules").update({ last_verified_at: "2026-10-28" }).eq("id", rule.id);
    expect(error).toBeNull();
  });

  it("rejects a rule without an https source at the database level", async () => {
    const { error } = await adminClient().from("labor_rules").insert({ ...rule, id: "zz-card_fees", topic: "card_fees", source_url: "javascript:alert(1)" });
    expect(error).not.toBeNull();
  });

  it("keeps break logs private", async () => {
    const { data } = await alice.client.from("break_logs").select("user_id");
    expect(data?.every((r) => r.user_id === alice.id)).toBe(true);
    expect((await alice.client.from("break_logs").insert({ ...breakLog, user_id: bob.id })).error).not.toBeNull();
    const { data: anon } = await anonClient().from("break_logs").select("id");
    expect(anon ?? []).toEqual([]);
  });

  it.each([
    ["unknown break type", { break_type: "smoke" }],
    ["unknown outcome", { outcome: "great" }],
    ["absurd minutes", { minutes: 600 }],
    ["overlong notes", { notes: "x".repeat(501) }],
  ])("rejects a break log with %s", async (_label, patch) => {
    expect((await alice.client.from("break_logs").insert({ ...breakLog, ...patch })).error).not.toBeNull();
  });

  it("deletes break logs with the account", async () => {
    const temp = await createTestUser("temp");
    await temp.client.from("break_logs").insert(breakLog);
    await deleteTestUser(temp);
    const { data } = await adminClient().from("break_logs").select("id").eq("user_id", temp.id);
    expect(data).toEqual([]);
  });
});
