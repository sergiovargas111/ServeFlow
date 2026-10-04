import { describe, expect, it } from "vitest";
import { clientIp, createRateLimiter, retryMessage } from "./rate-limit";

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createRateLimiter", () => {
  it("allows requests up to the limit, then blocks", () => {
    const c = clock();
    const rl = createRateLimiter({ limit: 3, windowMs: 1000, now: c.now });
    expect([1, 2, 3].map(() => rl.check("ip").allowed)).toEqual([true, true, true]);
    expect(rl.check("ip")).toEqual({ allowed: false, remaining: 0, retryAfterMs: 1000 });
  });

  it("counts remaining attempts down", () => {
    const rl = createRateLimiter({ limit: 2, windowMs: 1000, now: clock().now });
    expect(rl.check("ip").remaining).toBe(1);
    expect(rl.check("ip").remaining).toBe(0);
  });

  it("allows again once the window has passed", () => {
    const c = clock();
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: c.now });
    rl.check("ip");
    c.advance(999);
    expect(rl.check("ip").allowed).toBe(false);
    c.advance(1);
    expect(rl.check("ip").allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: clock().now });
    expect(rl.check("a").allowed).toBe(true);
    expect(rl.check("b").allowed).toBe(true);
    expect(rl.check("a").allowed).toBe(false);
  });

  it("does not let blocked requests extend the window", () => {
    const c = clock();
    const rl = createRateLimiter({ limit: 1, windowMs: 1000, now: c.now });
    rl.check("ip");
    c.advance(500);
    rl.check("ip");
    c.advance(500);
    expect(rl.check("ip").allowed).toBe(true);
  });

  it("caps memory when flooded with unique keys", () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 100, now: clock().now });
    for (let i = 0; i < 1000; i++) rl.check(`ip-${i}`);
    expect(rl.size).toBeLessThanOrEqual(100);
  });

  it("rejects nonsensical configuration", () => {
    expect(() => createRateLimiter({ limit: 0, windowMs: 1000 })).toThrow();
    expect(() => createRateLimiter({ limit: 1, windowMs: 0 })).toThrow();
  });
});

describe("clientIp", () => {
  const h = (init: Record<string, string>) => new Headers(init);

  it("uses the first x-forwarded-for address", () => {
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then 'unknown'", () => {
    expect(clientIp(h({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(h({}))).toBe("unknown");
  });
});

describe("retryMessage", () => {
  it("rounds up to whole minutes and pluralizes", () => {
    expect(retryMessage(1)).toBe("Too many attempts. Try again in 1 minute.");
    expect(retryMessage(61_000)).toBe("Too many attempts. Try again in 2 minutes.");
  });
});
