import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { userId: "user-a" as string | null, admin: false };
const calls: { table: string; op: string; args: unknown[] }[] = [];
const result = { error: null as { code: string } | null };

function chain(table: string, op: string, args: unknown[]) {
  calls.push({ table, op, args });
  const c = {
    eq: (...a: unknown[]) => {
      calls.push({ table, op: `${op}.eq`, args: a });
      return c;
    },
    then: (resolve: (v: unknown) => void) => resolve(result),
  };
  return c;
}

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/supabase/server", () => ({
  getUserId: async () => state.userId,
  isAdmin: async () => state.admin,
  createClient: async () => ({
    from: (table: string) => ({
      update: (...a: unknown[]) => chain(table, "update", a),
      insert: (...a: unknown[]) => chain(table, "insert", a),
      delete: (...a: unknown[]) => chain(table, "delete", a),
    }),
  }),
}));

async function load() {
  vi.resetModules();
  return import("./actions");
}

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

const today = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  state.userId = "user-a";
  state.admin = false;
  calls.length = 0;
  result.error = null;
});

describe("setState", () => {
  it("saves a valid state on the user's own profile", async () => {
    const { setState } = await load();
    expect(await setState({ state: "ca" })).toEqual({ status: "saved" });
    expect(calls).toEqual([
      { table: "profiles", op: "update", args: [{ state: "CA" }] },
      { table: "profiles", op: "update.eq", args: ["id", "user-a"] },
    ]);
  });

  it("clears the state when blank", async () => {
    const { setState } = await load();
    await setState({ state: "" });
    expect(calls[0].args).toEqual([{ state: null }]);
  });

  it("rejects unknown states and injection", async () => {
    const { setState } = await load();
    for (const bad of ["ZZ", "California", "'; DROP TABLE profiles; --", 42]) {
      expect((await setState({ state: bad })).status).toBe("error");
    }
    expect(calls).toEqual([]);
  });

  it("requires sign-in", async () => {
    state.userId = null;
    const { setState } = await load();
    expect(await setState({ state: "CA" })).toMatchObject({ status: "error", message: "Please sign in again." });
  });
});

describe("logBreak", () => {
  const valid = { shiftDate: today, breakType: "meal", outcome: "missed", minutes: "", paid: "unsure", notes: "" };

  it("saves a break under the session user", async () => {
    const { logBreak } = await load();
    expect((await logBreak({ status: "idle" }, form({ ...valid, user_id: "user-b" }))).status).toBe("saved");
    expect(calls[0]).toMatchObject({
      table: "break_logs",
      op: "insert",
      args: [{ user_id: "user-a", shift_date: today, break_type: "meal", outcome: "missed", minutes: null, paid: "unsure", notes: null }],
    });
  });

  it("validates on the server", async () => {
    const { logBreak } = await load();
    const r = await logBreak({ status: "idle" }, form({ ...valid, breakType: "smoke", minutes: "500", shiftDate: "2099-01-01" }));
    expect(Object.keys(r.fieldErrors ?? {}).sort()).toEqual(["breakType", "minutes", "shiftDate"]);
    expect(calls).toEqual([]);
  });

  it("stores script text in notes as plain text", async () => {
    const { logBreak } = await load();
    await logBreak({ status: "idle" }, form({ ...valid, notes: "<script>alert(1)</script>" }));
    expect((calls[0].args[0] as { notes: string }).notes).toBe("<script>alert(1)</script>");
  });
});

describe("deleteBreak", () => {
  it("deletes only the session user's entry by a valid id", async () => {
    const { deleteBreak } = await load();
    const id = "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60";
    expect(await deleteBreak(id)).toEqual({ ok: true });
    expect(calls.filter((c) => c.op === "delete.eq").map((c) => c.args)).toEqual([
      ["id", id],
      ["user_id", "user-a"],
    ]);
    expect(await deleteBreak("1 OR 1=1")).toEqual({ ok: false });
  });
});

describe("updateRule (admin only)", () => {
  it("blocks normal users before touching the database", async () => {
    const { updateRule } = await load();
    expect(await updateRule({ action: "verify", id: "ca-meal_break" })).toEqual({
      status: "error",
      message: "Only admins can edit rules.",
    });
    expect(calls).toEqual([]);
  });

  it("blocks signed-out users", async () => {
    state.userId = null;
    state.admin = true;
    const { updateRule } = await load();
    expect((await updateRule({ action: "verify", id: "ca-meal_break" })).status).toBe("error");
    expect(calls).toEqual([]);
  });

  it("lets an admin stamp today's verification date", async () => {
    state.admin = true;
    const { updateRule } = await load();
    expect(await updateRule({ action: "verify", id: "ca-meal_break" })).toEqual({ status: "saved" });
    expect(calls[0]).toEqual({ table: "labor_rules", op: "update", args: [{ last_verified_at: today }] });
  });

  it("lets an admin change status, and rejects unknown statuses and ids", async () => {
    state.admin = true;
    const { updateRule } = await load();
    expect((await updateRule({ action: "status", id: "ca-meal_break", status: "needs_review" })).status).toBe("saved");
    expect((await updateRule({ action: "status", id: "ca-meal_break", status: "live" })).status).toBe("error");
    expect((await updateRule({ action: "verify", id: "x'; --" })).status).toBe("error");
    expect((await updateRule({ action: "rewrite", id: "ca-meal_break", plain_english: "anything" })).status).toBe("error");
  });
});
