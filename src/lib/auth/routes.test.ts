import { describe, expect, it } from "vitest";
import { decideRoute, isAuthPage, isProtectedPath, safeNextPath } from "./routes";

describe("isProtectedPath", () => {
  it.each(["/report", "/report/2026", "/learn", "/coach", "/rights", "/daily", "/log", "/budget", "/budget/settings", "/rights/breaks", "/admin/rules", "/account"])(
    "protects %s",
    (path) => {
      expect(isProtectedPath(path)).toBe(true);
    },
  );

  it.each(["/", "/login", "/signup", "/auth/callback", "/reports-public", "/logout-info"])(
    "leaves %s public",
    (path) => {
      expect(isProtectedPath(path)).toBe(false);
    },
  );
});

describe("isAuthPage", () => {
  it("matches login and signup only", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/signup")).toBe(true);
    expect(isAuthPage("/loginx")).toBe(false);
    expect(isAuthPage("/report")).toBe(false);
  });
});

describe("decideRoute", () => {
  it("redirects logged-out users from protected pages to login, keeping where they were going", () => {
    expect(decideRoute("/report", "?week=2", false)).toEqual({
      type: "redirect",
      to: "/login?next=%2Freport%3Fweek%3D2",
    });
  });

  it("lets logged-out users see public pages", () => {
    expect(decideRoute("/", "", false)).toEqual({ type: "next" });
    expect(decideRoute("/login", "", false)).toEqual({ type: "next" });
  });

  it("lets signed-in users into protected pages", () => {
    expect(decideRoute("/report", "", true)).toEqual({ type: "next" });
  });

  it("sends signed-in users away from login and signup", () => {
    expect(decideRoute("/login", "", true)).toEqual({ type: "redirect", to: "/report" });
    expect(decideRoute("/signup", "", true)).toEqual({ type: "redirect", to: "/report" });
  });
});

describe("safeNextPath", () => {
  it("keeps same-site relative paths", () => {
    expect(safeNextPath("/report?week=2")).toBe("/report?week=2");
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["absolute URL", "https://evil.example"],
    ["protocol-relative", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["javascript URL", "javascript:alert(1)"],
    ["control characters", "/report\r\nSet-Cookie: x=1"],
  ])("falls back to /report for %s", (_label, next) => {
    expect(safeNextPath(next)).toBe("/report");
  });
});
