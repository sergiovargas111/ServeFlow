import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ALLERGENS, buildMenuQuiz, canBuildMenuQuiz, MENU_QUIZ_LENGTH, type MenuItem } from "./menu-quiz";
import { grade } from "./progress";

const menu: MenuItem[] = [
  { id: "a", name: "Calamari", description: "Fried squid, lemon aioli", allergens: ["shellfish", "eggs", "wheat"] },
  { id: "b", name: "Caesar", description: "Romaine, parmesan, croutons", allergens: ["milk", "fish", "wheat", "eggs"] },
  { id: "c", name: "Ribeye", description: "14 oz steak, garlic butter", allergens: ["milk"] },
  { id: "d", name: "Pad Thai", description: "Rice noodles, peanuts, tamarind", allergens: ["peanuts", "soy", "eggs"] },
  { id: "e", name: "Tuna Poke", description: "Raw tuna, sesame, soy", allergens: ["fish", "sesame", "soy"] },
];

describe("buildMenuQuiz", () => {
  it("needs at least 4 described items", () => {
    expect(canBuildMenuQuiz(menu.slice(0, 3))).toBe(false);
    expect(buildMenuQuiz(menu.slice(0, 3), "s")).toEqual([]);
    const blank = menu.map((m, i) => (i < 2 ? { ...m, description: "  " } : m));
    expect(canBuildMenuQuiz(blank)).toBe(false);
    expect(canBuildMenuQuiz(menu)).toBe(true);
  });

  it("builds a full quiz with valid questions", () => {
    const quiz = buildMenuQuiz(menu, "seed-1");
    expect(quiz).toHaveLength(MENU_QUIZ_LENGTH);
    for (const q of quiz) {
      expect(q.choices.length).toBeGreaterThanOrEqual(3);
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.choices.length);
    }
  });

  it("is the same quiz for the same items and seed, whatever order the items arrive in", () => {
    expect(buildMenuQuiz([...menu].reverse(), "seed-1")).toEqual(buildMenuQuiz(menu, "seed-1"));
  });

  it("varies with the seed", () => {
    expect(buildMenuQuiz(menu, "seed-1")).not.toEqual(buildMenuQuiz(menu, "seed-2"));
  });

  it("asks correct allergen questions", () => {
    for (let s = 0; s < 20; s++) {
      for (const q of buildMenuQuiz(menu, `s${s}`)) {
        const m = /contains (.+)\?$/.exec(q.prompt);
        if (!m) continue;
        const item = menu.find((i) => i.name === q.choices[q.answer])!;
        expect(item.allergens.map((a) => a.replace("_", " "))).toContain(m[1]);
        for (const [i, name] of q.choices.entries()) {
          if (i === q.answer) continue;
          const other = menu.find((x) => x.name === name)!;
          expect(other.allergens.map((a) => a.replace("_", " "))).not.toContain(m[1]);
        }
      }
    }
  });

  it("asks correct description questions", () => {
    for (const q of buildMenuQuiz(menu, "seed-3")) {
      const m = /^What's in the (.+)\?$/.exec(q.prompt);
      if (!m) continue;
      expect(menu.find((i) => i.name === m[1])!.description).toBe(q.choices[q.answer]);
    }
  });

  it("can be graded server-side by rebuilding it from the seed", () => {
    const shown = buildMenuQuiz(menu, "seed-4");
    const answers = shown.map((q) => q.answer);
    expect(grade(buildMenuQuiz(menu, "seed-4"), answers).score).toBe(shown.length);
  });

  it("skips description questions when descriptions repeat", () => {
    const same = menu.map((m) => ({ ...m, description: "House special", allergens: [] }));
    expect(buildMenuQuiz(same, "s")).toEqual([]);
  });
});

describe("allergen list", () => {
  it("matches the menu_items_allergens check constraint in the migrations", () => {
    const dir = join(__dirname, "../../../supabase/migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
    const m = /allergens <@ array\[([^\]]*)\]/.exec(sql);
    expect(m).not.toBeNull();
    expect([...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])).toEqual([...ALLERGENS]);
  });
});
