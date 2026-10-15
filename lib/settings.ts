import { z } from "zod";
import { MODELS } from "@/lib/model-list";
import {
  LEVELS,
  MODE_USES,
  MODES,
  TENSES,
  THEMES,
  VERB_TYPES,
  type Level,
  type Mode,
  type Tense,
  type Theme,
  type VerbType,
} from "@/lib/options";

// The learner's settings (stored in localStorage).
// The backend picks one random combination per exercise.

// Every list is optional: a missing or empty list means "any value".
// .max() keeps the payload small since the lists can't hold more than the options.
export const settingsSchema = z.object({
  // A removed model saved in the browser falls back to the default instead of failing.
  model: z.enum(MODELS).optional().catch(undefined),
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

// Fixed values win over the settings: a review keeps the mode, level, tense and
// verb type of its mistake, and only the theme changes.
export function pickCombination(
  settings: Settings,
  fixed: Omit<Partial<Combination>, "theme"> = {},
): Combination {
  const mode = fixed.mode ?? pick(settings.modes, MODES);
  const uses = MODE_USES[mode];
  return {
    mode,
    level: fixed.level ?? pick(settings.levels, LEVELS),
    ...(uses.tense && { tense: fixed.tense ?? pick(settings.tenses, TENSES) }),
    ...(uses.verbType && {
      verbType: fixed.verbType ?? pick(settings.verbTypes, VERB_TYPES),
    }),
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
