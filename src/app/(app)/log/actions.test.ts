import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { userId: "user-a" as string | null, budget: null as Record<string, unknown> | null };
const insert = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("@/lib/supabase/server", () => ({
  getUserId: async () => state.userId,
  createClient: async () => ({
    from: (table: string) =>
      table === "budget_settings"
        ? { select: () => ({ maybeSingle: async () => ({ data: state.budget, error: null }) }) }
        : { insert },
  }),
}));

async function load() {
  vi.resetModules(); // fresh rate limiter
  return (await import("./actions")).logShift;
}

const today = new Date().toISOString().slice(0, 10);
const valid = { shiftDate: today, shiftType: "dinner", grossTips: "185.50" };

beforeEach(() => {
  state.userId = "user-a";
  state.budget = null;
  insert.mockReset().mockResolvedValue({ error: null });
  revalidatePath.mockReset();
});

describe("logShift action", () => {
  it("rejects unauthenticated calls without touching the database", async () => {
    state.userId = null;
    const logShift = await load();
    expect(await logShift(valid)).toMatchObject({ status: "error", message: "Please sign in again." });
    expect(insert).not.toHaveBeenCalled();
  });

  it("saves a valid shift and refreshes the report", async () => {
    const logShift = await load();
    expect(await logShift(valid)).toEqual({ status: "saved" });
    expect(insert).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith("/report");
  });

  it("validates on the server and returns field errors", async () => {
    const logShift = await load();
    const result = await logShift({ ...valid, grossTips: "-5", hours: "40" });
    expect(result.status).toBe("error");
    if (result.status === "error") expect(Object.keys(result.fieldErrors ?? {})).toEqual(["grossTips", "hours"]);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects non-object input", async () => {
    const logShift = await load();
    for (const input of [null, "shift", 42, []]) expect((await logShift(input)).status).toBe("error");
    expect(insert).not.toHaveBeenCalled();
  });

  it("always saves under the session user, ignoring a user_id in the input", async () => {
    const logShift = await load();
    await logShift({ ...valid, user_id: "user-b", userId: "user-b" });
    expect(insert.mock.calls[0][0].user_id).toBe("user-a");
  });

  it("treats a retried offline sync (same clientId) as already saved", async () => {
    insert.mockResolvedValue({ error: { code: "23505" } });
    const logShift = await load();
    const result = await logShift({ ...valid, clientId: "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60" });
    expect(result).toEqual({ status: "saved", duplicate: true });
  });

  it("returns a retryable error when the database fails", async () => {
    insert.mockResolvedValue({ error: { code: "08006" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const logShift = await load();
    expect(await logShift(valid)).toMatchObject({ status: "error", retryable: true });
  });

  it("never logs tip amounts when saving fails", async () => {
    insert.mockResolvedValue({ error: { code: "08006" } });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logShift = await load();
    await logShift({ ...valid, grossTips: "987.65" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("987");
  });

  it("rate-limits a user after 60 shifts in an hour", async () => {
    const logShift = await load();
    for (let i = 0; i < 60; i++) await logShift(valid);
    expect(await logShift(valid)).toMatchObject({ status: "error", retryable: true });
    expect(insert).toHaveBeenCalledTimes(60);
  });

  describe("automatic tip-out", () => {
    const budget = {
      bar_pct: "5.00",
      bar_basis: "tips",
      busser_pct: "1.50",
      busser_basis: "sales",
      host_pct: "0",
      host_basis: "tips",
      split_bills: 50,
      split_savings: 10,
      split_spending: 25,
      split_taxes: 15,
    };

    it("fills in a blank tip-out from the user's settings", async () => {
      state.budget = budget;
      const logShift = await load();
      await logShift({ ...valid, grossTips: "200", sales: "1000" });
      expect(insert.mock.calls[0][0]).toMatchObject({ tip_out: 25, sales: 1000 }); // $10 bar + $15 busser
    });

    it("keeps a tip-out the user typed in", async () => {
      state.budget = budget;
      const logShift = await load();
      await logShift({ ...valid, grossTips: "200", tipOut: "12" });
      expect(insert.mock.calls[0][0].tip_out).toBe(12);
    });

    it("leaves out sales-based tip-outs when sales weren't entered", async () => {
      state.budget = budget;
      const logShift = await load();
      await logShift({ ...valid, grossTips: "200" });
      expect(insert.mock.calls[0][0]).toMatchObject({ tip_out: 10, sales: null });
    });

    it("saves no tip-out when the user has no settings", async () => {
      const logShift = await load();
      await logShift(valid);
      expect(insert.mock.calls[0][0].tip_out).toBe(0);
    });

    it("rejects an absurd sales amount", async () => {
      const logShift = await load();
      const result = await logShift({ ...valid, sales: "5000000" });
      expect(result).toMatchObject({ status: "error", fieldErrors: { sales: expect.any(String) } });
    });
  });
});
