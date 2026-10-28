import type { Question } from "./content";
import { rng, shuffle } from "./random";

/**
 * Menu quizzes built from the user's own menu items. Questions are generated
 * deterministically from (items, seed), so the server can rebuild exactly the
 * same quiz to grade it without trusting the client.
 */

/** The nine major food allergens in the US. Must match menu_items_allergens in supabase/migrations. */
export const ALLERGENS = ["milk", "eggs", "fish", "shellfish", "tree_nuts", "peanuts", "wheat", "soy", "sesame"] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  milk: "milk",
  eggs: "eggs",
  fish: "fish",
  shellfish: "shellfish",
  tree_nuts: "tree nuts",
  peanuts: "peanuts",
  wheat: "wheat",
  soy: "soy",
  sesame: "sesame",
};

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  allergens: readonly Allergen[];
}

export const MIN_MENU_ITEMS = 4;
export const MENU_QUIZ_LENGTH = 5;
export const MENU_DRILL_ID = "menu";

function multipleChoice(prompt: string, correct: string, wrong: readonly string[], why: string, rand: () => number): Question {
  const choices = shuffle([correct, ...wrong.slice(0, 3)], rand);
  return { prompt, choices, answer: choices.indexOf(correct), why };
}

export function canBuildMenuQuiz(items: readonly MenuItem[]): boolean {
  return items.filter((i) => i.description.trim() !== "").length >= MIN_MENU_ITEMS;
}

/**
 * Up to MENU_QUIZ_LENGTH questions mixing "What's in {dish}?" and "Which dish
 * has {allergen}?". Returns [] until there are MIN_MENU_ITEMS items with a
 * description.
 */
export function buildMenuQuiz(items: readonly MenuItem[], seed: string, length = MENU_QUIZ_LENGTH): Question[] {
  if (!canBuildMenuQuiz(items)) return [];
  const rand = rng(seed);
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  const described = sorted.filter((i) => i.description.trim() !== "");
  const candidates: (() => Question)[] = [];

  for (const item of described) {
    const otherDescriptions = [...new Set(described.filter((o) => o.description !== item.description).map((o) => o.description))];
    if (otherDescriptions.length < 3) continue;
    candidates.push(() => {
      const others = shuffle(otherDescriptions, rand);
      return multipleChoice(`What's in the ${item.name}?`, item.description, others, `${item.name}: ${item.description}`, rand);
    });
  }

  for (const allergen of ALLERGENS) {
    const withIt = sorted.filter((i) => i.allergens.includes(allergen));
    const without = sorted.filter((i) => !i.allergens.includes(allergen));
    if (withIt.length === 0 || without.length < 3) continue;
    candidates.push(() => {
      const item = withIt[Math.floor(rand() * withIt.length)];
      const wrong = shuffle(without, rand).map((o) => o.name);
      return multipleChoice(
        `Which of these contains ${ALLERGEN_LABELS[allergen]}?`,
        item.name,
        wrong,
        `Per your menu notes, the ${item.name} contains ${ALLERGEN_LABELS[allergen]}. Always confirm allergens with the kitchen.`,
        rand,
      );
    });
  }

  return shuffle(candidates, rand)
    .slice(0, length)
    .map((make) => make());
}
