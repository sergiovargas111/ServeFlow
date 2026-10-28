import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { userId: "user-a" as string | null };
const upsert = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidatePath(p) }));
vi.mock("@/lib/supabase/server", () => ({
  getUserId: async () => state.userId,
  createClient: async () => ({ from: () => ({ upsert }) }),
}));

async function load() {
  vi.resetModules(); // fresh rate limiter
  return (await import("./actions")).saveBudgetSettings;
}

const valid = {
  barPct: "5",
  barBasis: "tips",
  busserPct: "1.5",
  busserBasis: "sales",
  hostPct: "0",
  hostBasis: "tips",
  splitBills: "50",
  splitSavings: "10",
  splitSpending: "25",
  splitTaxes: "15",
};

function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}

beforeEach(() => {
  state.userId = "user-a";
  upsert.mockReset().mockResolvedValue({ error: null });
  revalidatePath.mockReset();
});

describe("saveBudgetSettings action", () => {
  it("rejects unauthenticated calls without touching the database", async () => {
    state.userId = null;
    const save = await load();
    expect(await save({ status: "idle" }, form(valid))).toMatchObject({ status: "error", message: "Please sign in again." });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("saves valid settings under the session user", async () => {
    const save = await load();
    const f = form({ ...valid, user_id: "user-b" });
    expect(await save({ status: "idle" }, f)).toMatchObject({ status: "saved" });
    expect(upsert.mock.calls[0][0]).toMatchObject({ user_id: "user-a", bar_pct: 5, busser_pct: 1.5, busser_basis: "sales" });
    expect(revalidatePath).toHaveBeenCalledWith("/budget");
  });

  it("validates on the server: a 200% tip-out and a split over 100 are rejected", async () => {
    const save = await load();
    const r = await save({ status: "idle" }, form({ ...valid, barPct: "200", splitBills: "60" }));
    expect(r.status).toBe("error");
    expect(Object.keys(r.fieldErrors ?? {})).toEqual(expect.arrayContaining(["barPct"]));
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns what was typed so the form keeps it", async () => {
    const save = await load();
    const r = await save({ status: "idle" }, form({ ...valid, splitBills: "99" }));
    expect(r.values?.splitBills).toBe("99");
  });

  it("returns a friendly error when the database fails", async () => {
    upsert.mockResolvedValue({ error: { code: "23514" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const save = await load();
    expect(await save({ status: "idle" }, form(valid))).toMatchObject({ status: "error" });
  });

  it("rate-limits a user after 30 saves in 15 minutes", async () => {
    const save = await load();
    for (let i = 0; i < 30; i++) await save({ status: "idle" }, form(valid));
    expect((await save({ status: "idle" }, form(valid))).message).toMatch(/Too many attempts/);
    expect(upsert).toHaveBeenCalledTimes(30);
  });
});
