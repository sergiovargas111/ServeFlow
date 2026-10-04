import { z } from "zod";

/** Must stay in sync with profiles_username_not_reserved in supabase/migrations (a test checks this). */
export const RESERVED_USERNAMES = [
  "admin",
  "administrator",
  "root",
  "support",
  "help",
  "serveflow",
  "staff",
  "moderator",
  "mod",
  "system",
  "null",
  "undefined",
  "me",
] as const;

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export const usernameSchema = z
  .string({ error: "Pick a username." })
  .trim()
  .toLowerCase()
  .min(3, { error: "Usernames are 3 to 20 characters." })
  .max(20, { error: "Usernames are 3 to 20 characters." })
  .regex(USERNAME_PATTERN, { error: "Use only letters, numbers and underscores." })
  .refine((name) => !(RESERVED_USERNAMES as readonly string[]).includes(name), {
    error: "That username is reserved. Try another.",
  });

export const emailSchema = z
  .string({ error: "Enter your email." })
  .trim()
  .toLowerCase()
  .max(254, { error: "That email is too long." })
  .pipe(z.email({ error: "Enter a valid email." }));

// 72 bytes is bcrypt's limit; anything longer would be silently truncated.
export const passwordSchema = z
  .string({ error: "Enter a password." })
  .min(8, { error: "Use at least 8 characters." })
  .refine((p) => new TextEncoder().encode(p).length <= 72, {
    error: "Use at most 72 characters.",
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Enter your password." }).max(200),
});

export const signupSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

/** First error message per field, for showing next to form inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Reads only the named string fields from FormData; files and unknown keys are ignored. */
export function pickFormFields<K extends string>(
  form: FormData,
  keys: readonly K[],
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const key of keys) {
    const value = form.get(key);
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
