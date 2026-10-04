import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Static guard: runs everywhere (no database needed) and fails the build if a
// migration creates a public table without turning on Row Level Security.

const dir = __dirname;
const sql = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(dir, f), "utf8"))
  .join("\n")
  .toLowerCase();

const tables = [...sql.matchAll(/create table (?:if not exists )?public\.(\w+)/g)].map((m) => m[1]);

describe("supabase migrations", () => {
  it("creates at least one table", () => {
    expect(tables.length).toBeGreaterThan(0);
  });

  it.each(tables)("enables row level security on public.%s", (table) => {
    expect(sql).toContain(`alter table public.${table} enable row level security`);
  });

  it.each(tables)("revokes anonymous access to public.%s", (table) => {
    expect(sql).toContain(`revoke all on public.${table} from anon`);
  });

  it("never grants table access to the anon role", () => {
    expect(sql).not.toMatch(/grant [^;]* on (table )?public\.\w+ to [^;]*anon/);
  });

  it("pins search_path on every security definer function", () => {
    const definers = [...sql.matchAll(/create (?:or replace )?function[\s\S]*?\$\$;/g)]
      .map((m) => m[0])
      .filter((fn) => fn.includes("security definer"));
    expect(definers.length).toBeGreaterThan(0);
    for (const fn of definers) expect(fn).toContain("set search_path = ''");
  });
});
