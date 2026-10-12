import { z } from "zod";

// Options the user can multi-select in the settings panel (stored in localStorage).
// The backend picks one random combination per exercise.

export const MODES = ["mot", "verbe", "phrasal verb", "phrase"] as const;

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

// Regular or irregular in English, since that's what the learner must produce.
export const VERB_TYPES = ["régulier", "irrégulier"] as const;

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

export type Mode = (typeof MODES)[number];
export type Level = (typeof LEVELS)[number];
export type Tense = (typeof TENSES)[number];
export type VerbType = (typeof VERB_TYPES)[number];
export type Theme = (typeof THEMES)[number];

// Which settings apply to each mode; the others are ignored for that mode.
export const MODE_USES = {
  mot: { tense: false, verbType: false, theme: true },
  verbe: { tense: false, verbType: true, theme: false },
  "phrasal verb": { tense: false, verbType: false, theme: true },
  phrase: { tense: true, verbType: false, theme: true },
} satisfies Record<Mode, { tense: boolean; verbType: boolean; theme: boolean }>;

// Every list is optional: a missing or empty list means "any value".
// .max() keeps the payload small since the lists can't hold more than the options.
export const settingsSchema = z.object({
  modes: z.array(z.enum(MODES)).max(MODES.length).optional(),
  levels: z.array(z.enum(LEVELS)).max(LEVELS.length).optional(),
  tenses: z.array(z.enum(TENSES)).max(TENSES.length).optional(),
  verbTypes: z.array(z.enum(VERB_TYPES)).max(VERB_TYPES.length).optional(),
  themes: z.array(z.enum(THEMES)).max(THEMES.length).optional(),
});

export type Settings = z.infer<typeof settingsSchema>;

export type Combination = {
  mode: Mode;
  level: Level;
  tense?: Tense;
  verbType?: VerbType;
  theme?: Theme;
};

function pick<T>(selected: readonly T[] | undefined, all: readonly T[]): T {
  const pool = selected && selected.length > 0 ? selected : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickCombination(settings: Settings): Combination {
  const mode = pick(settings.modes, MODES);
  const uses = MODE_USES[mode];
  return {
    mode,
    level: pick(settings.levels, LEVELS),
    ...(uses.tense && { tense: pick(settings.tenses, TENSES) }),
    ...(uses.verbType && { verbType: pick(settings.verbTypes, VERB_TYPES) }),
    ...(uses.theme && { theme: pick(settings.themes, THEMES) }),
  };
}

// True when at least one selected mode (or any mode, if none is selected) uses the setting.
export function settingApplies(
  settings: Settings,
  setting: keyof (typeof MODE_USES)[Mode],
) {
  const modes = settings.modes?.length ? settings.modes : MODES;
  return modes.some((mode) => MODE_USES[mode][setting]);
}
