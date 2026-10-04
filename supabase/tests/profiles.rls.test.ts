import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createTestUser, deleteTestUser, hasTestDb, type TestUser } from "./helpers";

describe.skipIf(!hasTestDb)("profiles RLS (integration)", () => {
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    alice = await createTestUser("alice");
    bob = await createTestUser("bob");
  });

  afterAll(async () => {
    await deleteTestUser(alice);
    await deleteTestUser(bob);
  });

  it("creates a profile automatically on signup", async () => {
    const { data } = await adminClient().from("profiles").select("id").eq("id", alice.id);
    expect(data).toHaveLength(1);
  });

  it("lets a user read their own profile", async () => {
    const { data, error } = await alice.client.from("profiles").select("id").eq("id", alice.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("never returns another user's profile", async () => {
    const { data } = await alice.client.from("profiles").select("id").eq("id", bob.id);
    expect(data).toEqual([]);
    const { data: all } = await alice.client.from("profiles").select("id");
    expect(all?.map((r) => r.id)).toEqual([alice.id]);
  });

  it("can't update another user's profile", async () => {
    await alice.client.from("profiles").update({ city: "Hacked" }).eq("id", bob.id);
    const { data } = await adminClient().from("profiles").select("city").eq("id", bob.id).single();
    expect(data?.city).toBeNull();
  });

  it("can't move their own profile onto another user's id", async () => {
    const { error } = await alice.client.from("profiles").update({ id: bob.id }).eq("id", alice.id);
    expect(error).not.toBeNull();
  });

  it("can't insert profiles directly", async () => {
    const { error } = await alice.client.from("profiles").insert({ id: alice.id, username: "sneaky_insert" });
    expect(error).not.toBeNull();
  });

  it("can't delete profiles directly", async () => {
    await alice.client.from("profiles").delete().eq("id", alice.id);
    const { data } = await adminClient().from("profiles").select("id").eq("id", alice.id);
    expect(data).toHaveLength(1);
  });

  it("rejects reserved and malformed usernames at the database level", async () => {
    for (const username of ["admin", "!!!", "<script>"]) {
      const { error } = await alice.client.from("profiles").update({ username }).eq("id", alice.id);
      expect(error).not.toBeNull();
    }
  });

  it("stores SQL-injection text as plain text", async () => {
    const city = "'; DROP TABLE profiles; --";
    const { error } = await alice.client.from("profiles").update({ city }).eq("id", alice.id);
    expect(error).toBeNull();
    const { data } = await alice.client.from("profiles").select("city").eq("id", alice.id).single();
    expect(data?.city).toBe(city);
  });

  it("gives logged-out clients nothing", async () => {
    const { data } = await anonClient().from("profiles").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("treats a forged access token as unauthenticated", async () => {
    const forged = anonClient();
    await forged.auth.setSession({ access_token: "not.a.jwt", refresh_token: "nope" }).catch(() => undefined);
    const { data } = await forged.from("profiles").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("removes the profile when the account is deleted", async () => {
    const temp = await createTestUser("temp");
    await deleteTestUser(temp);
    const { data } = await adminClient().from("profiles").select("id").eq("id", temp.id);
    expect(data).toEqual([]);
  });
});
