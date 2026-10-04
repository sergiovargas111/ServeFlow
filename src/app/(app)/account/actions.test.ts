import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { userId: null as string | null };
const deleteUser = vi.fn();
const signOut = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({
  getUserId: async () => state.userId,
  createClient: async () => ({ auth: { signOut } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { deleteUser } } }),
}));

const { deleteAccount } = await import("./actions");

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const idle = { status: "idle" } as const;

beforeEach(() => {
  state.userId = "user-a";
  deleteUser.mockReset().mockResolvedValue({ error: null });
  signOut.mockReset();
});

describe("deleteAccount", () => {
  it("refuses when the session is missing or expired", async () => {
    state.userId = null;
    const result = await deleteAccount(idle, form({ confirm: "DELETE" }));
    expect(result.status).toBe("error");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("requires typing DELETE exactly", async () => {
    for (const confirm of ["", "delete", "DELETE "]) {
      const result = await deleteAccount(idle, form({ confirm }));
      expect(result.message).toBe("Type DELETE to confirm.");
    }
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("deletes only the signed-in user, ignoring any id in the form", async () => {
    await expect(deleteAccount(idle, form({ confirm: "DELETE", userId: "user-b" }))).rejects.toThrow(
      "REDIRECT:/?deleted=1",
    );
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith("user-a");
    expect(signOut).toHaveBeenCalled();
  });

  it("reports a failure without signing out", async () => {
    deleteUser.mockResolvedValue({ error: { message: "boom" } });
    const result = await deleteAccount(idle, form({ confirm: "DELETE" }));
    expect(result.status).toBe("error");
    expect(signOut).not.toHaveBeenCalled();
  });
});
