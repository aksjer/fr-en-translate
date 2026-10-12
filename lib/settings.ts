import { z } from "zod";

// Options the user can multi-select in the settings panel (stored in localStorage).
// The backend picks one random combination per sentence.

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export const TENSES = [
  "présent",
  "passé composé",
  "imparfait",
  "plus-que-parfait",
  "futur simple",
  "futur proche",
  "conditionnel présent",
  "subjonctif présent",
  "impératif",
] as const;

export const THEMES = [
  "vie quotidienne",
  "travail",
  "voyage",
  "nourriture",
  "loisirs",
  "santé",
  "famille et amis",
  "technologie",
  "nature",
  "culture",
] as const;

export type Level = (typeof LEVELS)[number];
export type Tense = (typeof TENSES)[number];
export type Theme = (typeof THEMES)[number];

// Every list is optional: a missing or empty list means "any value".
// .max() keeps the payload small since the lists can't hold more than the options.
export const settingsSchema = z.object({
  levels: z.array(z.enum(LEVELS)).max(LEVELS.length).optional(),
  tenses: z.array(z.enum(TENSES)).max(TENSES.length).optional(),
  themes: z.array(z.enum(THEMES)).max(THEMES.length).optional(),
});

export type Settings = z.infer<typeof settingsSchema>;

export type Combination = { level: Level; tense: Tense; theme: Theme };

function pick<T>(selected: readonly T[] | undefined, all: readonly T[]): T {
  const pool = selected && selected.length > 0 ? selected : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickCombination(settings: Settings): Combination {
  return {
    level: pick(settings.levels, LEVELS),
    tense: pick(settings.tenses, TENSES),
    theme: pick(settings.themes, THEMES),
  };
}
