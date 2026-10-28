/** Pages that require a signed-in user. Nested paths are protected too. */
export const PROTECTED_PREFIXES = ["/report", "/learn", "/coach", "/rights", "/daily", "/log", "/budget", "/admin", "/account"] as const;

/** Pages a signed-in user has no reason to see. */
export const AUTH_PAGES = ["/login", "/signup"] as const;

export const HOME_AFTER_LOGIN = "/report";

function matches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => matches(pathname, p));
}

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((p) => matches(pathname, p));
}

/**
 * Only allow same-site relative paths as post-login destinations, so a crafted
 * ?next= link can't bounce users to another site (open redirect).
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return HOME_AFTER_LOGIN;
  }
  if ([...next].some((ch) => ch.charCodeAt(0) < 0x20)) return HOME_AFTER_LOGIN;
  return next;
}

export type RouteDecision = { type: "next" } | { type: "redirect"; to: string };

export function decideRoute(pathname: string, search: string, signedIn: boolean): RouteDecision {
  if (!signedIn && isProtectedPath(pathname)) {
    const next = encodeURIComponent(pathname + search);
    return { type: "redirect", to: `/login?next=${next}` };
  }
  if (signedIn && isAuthPage(pathname)) {
    return { type: "redirect", to: HOME_AFTER_LOGIN };
  }
  return { type: "next" };
}
