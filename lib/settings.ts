import { z } from "zod";
import { focusWeights, type CommonMistake } from "@/lib/common-mistakes";
import {
  EFFORTS,
  MODE_USES,
  MODES,
  SENTENCE_FOCUSES,
  TENSES,
  THEMES,
  VERB_TYPES,
  WORD_KINDS,
  WORD_TYPES,
  pointName,
  type Mode,
  type SentenceFocus,
  type Tense,
  type Theme,
  type VerbType,
  type WordKind,
} from "@/lib/options";

// The learner's settings (stored in localStorage).
// The backend picks one random combination per exercise.

// Every list is optional: a missing or empty list means "any value".
// .max() keeps the payload small since the lists can't hold more than the options.
export const settingsSchema = z.object({
  modes: z.array(z.enum(MODES)).max(MODES.length).optional(),
  tenses: z.array(z.enum(TENSES)).max(TENSES.length).optional(),
  verbTypes: z.array(z.enum(VERB_TYPES)).max(VERB_TYPES.length).optional(),
  themes: z.array(z.enum(THEMES)).max(THEMES.length).optional(),
  wordTypes: z.array(z.enum(WORD_TYPES)).max(WORD_TYPES.length).optional(),
  // None means the default level.
  generateEffort: z.enum(EFFORTS).optional().catch(undefined),
  correctEffort: z.enum(EFFORTS).optional().catch(undefined),
});

export type Settings = z.infer<typeof settingsSchema>;

export type Combination = {
  mode: Mode;
  tense?: Tense;
  verbType?: VerbType;
  theme?: Theme;
  // The kind of word of a word item.
  kind?: WordKind;
  // The grammar point a sentence needs. None for about 1 in 4 sentences, which
  // practice a recent mistake or a weak point instead.
  focus?: SentenceFocus;
  // A sentence that practices the mistake of the wrong sentence just before.
  retest?: boolean;
  // The learning point of that wrong sentence, practiced again by the retest.
  retestPoint?: string;
  // The main mistake of that wrong sentence, when its point was right.
  retestMistake?: string;
  // One of the learner's recurring mistakes, practiced instead of a focus.
  target?: CommonMistake;
};

function pick<T>(selected: readonly T[] | undefined, all: readonly T[]): T {
  const pool = selected && selected.length > 0 ? selected : all;
  return pool[Math.floor(Math.random() * pool.length)];
}

// The selected word types that fit the mode; pick takes all of them if none does.
function typesFor<T extends string>(selected: readonly string[] | undefined, all: readonly T[]) {
  return all.filter((type) => selected?.includes(type));
}

// About 1 in 4 sentences practice the learner's own mistakes instead.
const MISTAKE_SENTENCE_CHANCE = 0.25;
// While the learner has recurring mistakes, half the sentences practice one,
// picked among the most frequent.
const TARGET_CHANCE = 0.5;
const TARGET_CHOICES = 3;

// A random value, each one as likely as its weight (1 at least).
function weightedPick<T>(values: readonly T[], weights: Map<T, number>): T {
  const total = values.reduce((sum, value) => sum + 1 + (weights.get(value) ?? 0), 0);
  let draw = Math.random() * total;
  for (const value of values) {
    draw -= 1 + (weights.get(value) ?? 0);
    if (draw < 0) return value;
  }
  return values[values.length - 1];
}

// One random value of each setting the mode uses. A sentence right after a
// wrong one practices its mistake again, while it is fresh, in the same tense
// if the settings still allow it: once, so a missed retest doesn't lead to
// another one.
export function pickCombination(
  settings: Settings,
  wrongSentence?: { tense?: Tense; point?: string; mistake?: string },
  // The learner's recurring mistakes, and the point of their last sentence,
  // which isn't practiced twice in a row.
  mistakes: CommonMistake[] = [],
  // Points no habit target may have: the last sentence's, the batch's others.
  usedPoints: (string | undefined)[] = [],
  // The mode of the batch, when another item of it already has one.
  batchMode?: Mode,
): Combination {
  const mode = batchMode ?? pick(settings.modes, MODES);
  const uses = MODE_USES[mode];
  const retest = mode === "sentence" && wrongSentence !== undefined;
  const targets = mistakes
    .slice(0, TARGET_CHOICES + 1)
    .filter(
      (mistake) =>
        !usedPoints.some((point) => point && pointName(point) === pointName(mistake.right)),
    )
    .slice(0, TARGET_CHOICES);
  const target =
    mode === "sentence" && !retest && targets.length && Math.random() < TARGET_CHANCE
      ? targets[Math.floor(Math.random() * targets.length)]
      : undefined;
  const selectedFocuses = typesFor(settings.wordTypes, SENTENCE_FOCUSES);
  const focuses = selectedFocuses.length ? selectedFocuses : SENTENCE_FOCUSES;
  const sameTense =
    retest &&
    wrongSentence.tense &&
    (!settings.tenses?.length || settings.tenses.includes(wrongSentence.tense))
      ? wrongSentence.tense
      : undefined;
  return {
    mode,
    ...(retest && { retest: true }),
    ...(retest && wrongSentence.point && { retestPoint: wrongSentence.point }),
    ...(retest &&
      !wrongSentence.point &&
      wrongSentence.mistake && { retestMistake: wrongSentence.mistake }),
    ...(uses.tense && { tense: sameTense ?? pick(settings.tenses, TENSES) }),
    ...(uses.verbType && {
      verbType: pick(settings.verbTypes, VERB_TYPES),
    }),
    ...(uses.theme && { theme: pick(settings.themes, THEMES) }),
    ...(mode === "word" && {
      kind: pick(typesFor(settings.wordTypes, WORD_KINDS), WORD_KINDS),
    }),
    ...(target && { target }),
    ...(mode === "sentence" &&
      !retest &&
      !target &&
      Math.random() >= MISTAKE_SENTENCE_CHANCE && {
        focus: weightedPick(focuses, focusWeights(mistakes)),
      }),
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
