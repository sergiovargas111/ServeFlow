import { createRateLimiter } from "./rate-limit";

// Shared limiter instances (module scope = one per server instance).
export const loginLimiterByIp = createRateLimiter({ limit: 10, windowMs: 5 * 60_000 });
// Slows credential stuffing against one account from many IPs.
export const loginLimiterByEmail = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });
export const signupLimiterByIp = createRateLimiter({ limit: 5, windowMs: 60 * 60_000 });
// Generous for real use (a double plus corrections), stops scripted floods.
export const shiftLogLimiterByUser = createRateLimiter({ limit: 60, windowMs: 60 * 60_000 });
// Settings forms: plenty for real edits, stops scripted floods.
export const settingsLimiterByUser = createRateLimiter({ limit: 30, windowMs: 15 * 60_000 });
// Drills, habits and menu edits: generous for real use, stops scripted floods.
export const practiceLimiterByUser = createRateLimiter({ limit: 120, windowMs: 15 * 60_000 });
// Rights screen: state changes, break log entries, admin rule edits.
export const rightsLimiterByUser = createRateLimiter({ limit: 60, windowMs: 15 * 60_000 });
// The coach calls a paid API: enough for a real shift's questions, not for scripts.
export const coachLimiterByUser = createRateLimiter({ limit: 30, windowMs: 60 * 60_000 });
