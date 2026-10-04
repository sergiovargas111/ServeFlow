import { beforeEach, describe, expect, it, vi } from "vitest";

// Calls the real server actions with Next/Supabase boundaries mocked, so these
// tests exercise server-side validation and rate limiting directly.

let requestHeaders = new Headers();
const supabase = {
  auth: { signInWithPassword: vi.fn(), signUp: vi.fn() },
  rpc: vi.fn(),
};

vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabase }));
vi.mock("@/lib/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env")>()),
  getPublicSupabaseEnv: () => ({ url: "http://supabase.test", publishableKey: "test" }),
}));

async function loadActions() {
  vi.resetModules(); // fresh rate limiters per test
  return import("./actions");
}

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const idle = { status: "idle" } as const;

beforeEach(() => {
  requestHeaders = new Headers({ "x-forwarded-for": "203.0.113.9" });
  supabase.auth.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  supabase.auth.signUp.mockReset().mockResolvedValue({ data: { session: {} }, error: null });
  supabase.rpc.mockReset().mockResolvedValue({ data: true, error: null });
});

describe("login action", () => {
  it("rejects invalid input on the server without calling Supabase", async () => {
    const { login } = await loadActions();
    const state = await login(idle, form({ email: "not-an-email", password: "" }));
    expect(state.status).toBe("error");
    expect(state.fieldErrors).toHaveProperty("email");
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("uses one generic message for bad credentials", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const { login } = await loadActions();
    const state = await login(idle, form({ email: "m@x.com", password: "wrongpass" }));
    expect(state.message).toBe("Email or password is incorrect.");
  });

  it("redirects to a safe next path on success", async () => {
    const { login } = await loadActions();
    await expect(login(idle, form({ email: "m@x.com", password: "tips4days", next: "//evil.com" }))).rejects.toThrow(
      "REDIRECT:/report",
    );
  });

  it("blocks the 11th attempt from one IP within 5 minutes", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ error: { message: "nope" } });
    const { login } = await loadActions();
    for (let i = 0; i < 10; i++) await login(idle, form({ email: `u${i}@x.com`, password: "wrongpass" }));
    const state = await login(idle, form({ email: "last@x.com", password: "wrongpass" }));
    expect(state.message).toMatch(/Too many attempts/);
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(10);
  });

  it("blocks the 6th attempt on one email even from different IPs", async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({ error: { message: "nope" } });
    const { login } = await loadActions();
    for (let i = 0; i < 5; i++) {
      requestHeaders = new Headers({ "x-forwarded-for": `198.51.100.${i}` });
      await login(idle, form({ email: "target@x.com", password: "wrongpass" }));
    }
    requestHeaders = new Headers({ "x-forwarded-for": "198.51.100.99" });
    const state = await login(idle, form({ email: "TARGET@x.com", password: "wrongpass" }));
    expect(state.message).toMatch(/Too many attempts/);
  });
});

describe("signup action", () => {
  const valid = { username: "maria", email: "m@x.com", password: "tips4days" };

  it.each([
    ["SQL injection", "'; DROP TABLE shifts; --"],
    ["XSS", "<script>alert(1)</script>"],
    ["reserved", "admin"],
    ["punctuation", "!!!"],
  ])("rejects a %s username on the server", async (_label, username) => {
    const { signup } = await loadActions();
    const state = await signup(idle, form({ ...valid, username }));
    expect(state.fieldErrors).toHaveProperty("username");
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("reports a taken username without creating the account", async () => {
    supabase.rpc.mockResolvedValue({ data: false, error: null });
    const { signup } = await loadActions();
    const state = await signup(idle, form(valid));
    expect(state.fieldErrors?.username).toBe("That username is taken.");
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("passes the normalized username as signup metadata", async () => {
    const { signup } = await loadActions();
    await expect(signup(idle, form({ ...valid, username: " Maria " }))).rejects.toThrow("REDIRECT:/report");
    expect(supabase.auth.signUp.mock.calls[0][0].options.data).toEqual({ username: "maria" });
  });

  it("asks the user to check their email when confirmation is required", async () => {
    supabase.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const { signup } = await loadActions();
    const state = await signup(idle, form(valid));
    expect(state.status).toBe("check-email");
  });

  it("blocks the 6th signup from one IP within an hour", async () => {
    supabase.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const { signup } = await loadActions();
    for (let i = 0; i < 5; i++) await signup(idle, form({ ...valid, username: `maria${i}` }));
    const state = await signup(idle, form({ ...valid, username: "maria9" }));
    expect(state.message).toMatch(/Too many attempts/);
  });
});
