import { z } from "zod";
import {
  MODE_USES,
  MODES,
  TENSES,
  THEMES,
  VERB_TYPES,
  WORD_TYPES,
  type Mode,
} from "@/lib/options";

// The learner's settings (stored in localStorage). An empty or missing list
// means any value. A value that no longer exists is dropped, so old settings
// still load.
function list<T extends string>(values: readonly T[]) {
  return z
    .array(z.string())
    .max(50)
    .optional()
    .transform((selected) =>
      selected?.filter((value): value is T => (values as readonly string[]).includes(value)),
    );
}

export const settingsSchema = z.object({
  modes: list(MODES),
  tenses: list(TENSES),
  verbTypes: list(VERB_TYPES),
  themes: list(THEMES),
  wordTypes: list(WORD_TYPES),
});

export type Settings = z.infer<typeof settingsSchema>;

// A random selected value, or any value when none is selected.
export function pick<T>(selected: readonly T[] | undefined, all: readonly T[]): T {
  const pool = selected?.length ? selected : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

// True when a selected mode (or any mode, if none is selected) uses the setting.
export function settingApplies(settings: Settings, setting: keyof (typeof MODE_USES)[Mode]) {
  const modes = settings.modes?.length ? settings.modes : MODES;
  return modes.some((mode) => MODE_USES[mode][setting]);
}
