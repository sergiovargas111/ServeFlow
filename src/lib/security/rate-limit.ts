/**
 * Fixed-window rate limiter kept in memory.
 *
 * Good enough for one server instance and for slowing down brute-force
 * attempts. On Vercel each serverless instance has its own memory, so limits
 * are per instance; Supabase Auth applies its own server-side limits on top.
 * Swap the store for a shared one (e.g. Postgres or Redis) before relying on
 * it for anything stronger.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  /** Upper bound on tracked keys so a flood of unique keys can't exhaust memory. */
  maxKeys?: number;
  now?: () => number;
}

export function createRateLimiter({ limit, windowMs, maxKeys = 10_000, now = Date.now }: RateLimiterOptions) {
  if (limit < 1 || windowMs <= 0) throw new Error("limit must be >= 1 and windowMs > 0");
  const windows = new Map<string, { start: number; count: number }>();

  function prune(at: number) {
    for (const [key, w] of windows) if (at - w.start >= windowMs) windows.delete(key);
    // Still full? Drop the oldest entries (Map keeps insertion order).
    while (windows.size >= maxKeys) windows.delete(windows.keys().next().value!);
  }

  return {
    check(key: string): RateLimitResult {
      const at = now();
      let w = windows.get(key);
      if (!w || at - w.start >= windowMs) {
        if (!w && windows.size >= maxKeys) prune(at);
        w = { start: at, count: 0 };
        windows.set(key, w);
      }
      const retryAfterMs = w.start + windowMs - at;
      if (w.count >= limit) return { allowed: false, remaining: 0, retryAfterMs };
      w.count += 1;
      return { allowed: true, remaining: limit - w.count, retryAfterMs };
    },
    reset() {
      windows.clear();
    },
    get size() {
      return windows.size;
    },
  };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export function retryMessage(retryAfterMs: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
