import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  emailSchema,
  fieldErrors,
  loginSchema,
  passwordSchema,
  pickFormFields,
  RESERVED_USERNAMES,
  signupSchema,
  usernameSchema,
} from "./auth";

const SQL_INJECTION = "'; DROP TABLE shifts; --";
const XSS = "<script>alert(1)</script>";

describe("usernameSchema", () => {
  it.each(["maria", "server_22", "abc", "a".repeat(20)])("accepts %s", (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(usernameSchema.parse("  Maria_B ")).toBe("maria_b");
  });

  it.each([
    ["punctuation only", "!!!"],
    ["empty", ""],
    ["whitespace only", "     "],
    ["too short", "ab"],
    ["too long", "a".repeat(21)],
    ["emoji", "maria🍝"],
    ["accented unicode", "josé"],
    ["lookalike cyrillic", "аdmin"],
    ["spaces inside", "big tips"],
    ["SQL injection", SQL_INJECTION],
    ["XSS payload", XSS],
  ])("rejects %s", (_label, name) => {
    expect(usernameSchema.safeParse(name).success).toBe(false);
  });

  it.each(RESERVED_USERNAMES)("rejects reserved name %s", (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(false);
  });

  it("rejects reserved names regardless of case", () => {
    expect(usernameSchema.safeParse("ADMIN").success).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(usernameSchema.safeParse(12345).success).toBe(false);
    expect(usernameSchema.safeParse(null).success).toBe(false);
  });

  it("keeps the reserved list in sync with the database constraint", () => {
    const dir = join(__dirname, "../../../supabase/migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
    const match = sql.match(/username not in \(([^)]*)\)/);
    expect(match).not.toBeNull();
    const dbNames = [...match![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(dbNames).toEqual([...RESERVED_USERNAMES].sort());
  });
});

describe("emailSchema", () => {
  it("accepts and normalizes a valid email", () => {
    expect(emailSchema.parse(" Server@Example.COM ")).toBe("server@example.com");
  });

  it.each(["", "not-an-email", "a@b", `${"a".repeat(250)}@x.com`, SQL_INJECTION, XSS])(
    "rejects %s",
    (email) => {
      expect(emailSchema.safeParse(email).success).toBe(false);
    },
  );
});

describe("passwordSchema", () => {
  it("accepts 8+ characters", () => {
    expect(passwordSchema.safeParse("tips4days").success).toBe(true);
  });

  it("rejects passwords under 8 characters", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
  });

  it("rejects passwords over 72 bytes, counting multi-byte characters", () => {
    expect(passwordSchema.safeParse("a".repeat(73)).success).toBe(false);
    expect(passwordSchema.safeParse("é".repeat(37)).success).toBe(false); // 74 bytes
  });
});

describe("signupSchema / loginSchema", () => {
  it("accepts a valid signup", () => {
    const result = signupSchema.safeParse({ username: "maria", email: "m@x.com", password: "tips4days" });
    expect(result.success).toBe(true);
  });

  it("reports one message per invalid field", () => {
    const result = signupSchema.safeParse({ username: "!!!", email: "nope", password: "x" });
    expect(result.success).toBe(false);
    const errors = fieldErrors(result.error!);
    expect(Object.keys(errors).sort()).toEqual(["email", "password", "username"]);
  });

  it("rejects a login with an empty password", () => {
    expect(loginSchema.safeParse({ email: "m@x.com", password: "" }).success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
  });
});

describe("pickFormFields", () => {
  it("returns only the requested string fields", () => {
    const form = new FormData();
    form.set("email", "m@x.com");
    form.set("role", "admin");
    form.set("avatar", new Blob(["x"]), "x.png");
    expect(pickFormFields(form, ["email", "avatar"] as const)).toEqual({ email: "m@x.com" });
  });
});
