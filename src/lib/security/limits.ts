import { createRateLimiter } from "./rate-limit";

// Shared limiter instances (module scope = one per server instance).
export const loginLimiterByIp = createRateLimiter({ limit: 10, windowMs: 5 * 60_000 });
// Slows credential stuffing against one account from many IPs.
export const loginLimiterByEmail = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });
export const signupLimiterByIp = createRateLimiter({ limit: 5, windowMs: 60 * 60_000 });
