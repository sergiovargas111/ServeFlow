export type TabId = "report" | "learn" | "coach" | "rights" | "daily";

export interface Tab {
  id: TabId;
  label: string;
  href: `/${TabId}`;
}

/** Bottom tab bar order, left to right. Report sits under the left thumb. */
export const TABS: readonly Tab[] = [
  { id: "report", label: "Report", href: "/report" },
  { id: "learn", label: "Learn", href: "/learn" },
  { id: "coach", label: "Coach", href: "/coach" },
  { id: "rights", label: "Rights", href: "/rights" },
  { id: "daily", label: "Daily", href: "/daily" },
];

/** A tab is active on its own path and on any nested path, but not on look-alike prefixes. */
export function isTabActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
