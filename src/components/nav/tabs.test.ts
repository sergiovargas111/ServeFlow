import { describe, expect, it } from "vitest";
import { isTabActive, TABS } from "./tabs";

describe("isTabActive", () => {
  it("is active on the tab's own path", () => {
    expect(isTabActive("/report", "/report")).toBe(true);
  });

  it("is active on nested paths under the tab", () => {
    expect(isTabActive("/report/history", "/report")).toBe(true);
  });

  it("is not active on a path that only shares a prefix", () => {
    expect(isTabActive("/reports", "/report")).toBe(false);
  });

  it("is not active on other tabs", () => {
    expect(isTabActive("/coach", "/report")).toBe(false);
  });
});

describe("TABS", () => {
  it("lists the five tabs from the plan in order", () => {
    expect(TABS.map((t) => t.label)).toEqual(["Report", "Learn", "Coach", "Rights", "Daily"]);
  });

  it("has unique hrefs", () => {
    expect(new Set(TABS.map((t) => t.href)).size).toBe(TABS.length);
  });
});
