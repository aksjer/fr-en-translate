// The values the learner can pick in the settings panel.

export const MODES = ["word", "verb", "sentence"] as const;
export const TENSES = [
  "present",
  "past",
  "present perfect",
  "past perfect",
  "future",
  "conditional",
] as const;
export const VERB_TYPES = ["regular", "irregular"] as const;
export const THEMES = [
  "daily life",
  "work",
  "travel",
  "food",
  "hobbies",
  "health",
  "family and friends",
  "technology",
  "nature",
  "culture",
  "news",
  "cars and EVs",
  "movies and TV shows",
] as const;
export const WORD_TYPES = [
  "noun",
  "adjective",
  "adverb",
  "modal",
  "preposition",
  "conjunction",
] as const;

export type Mode = (typeof MODES)[number];
export type Tense = (typeof TENSES)[number];
export type VerbType = (typeof VERB_TYPES)[number];
export type Theme = (typeof THEMES)[number];
export type WordType = (typeof WORD_TYPES)[number];

// Which settings each mode uses; the others are ignored for that mode.
export const MODE_USES = {
  word: { tense: false, verbType: false, theme: true, wordType: true },
  verb: { tense: false, verbType: true, theme: true, wordType: false },
  sentence: { tense: true, verbType: false, theme: true, wordType: false },
} satisfies Record<Mode, Record<"tense" | "verbType" | "theme" | "wordType", boolean>>;

// The longest item or answer, in characters.
export const MAX_TEXT_LENGTH = 1000;

// The last English items of a mode sent to the generation, so they don't come again.
export const MAX_AVOID = 50;

// The same English whatever its case, spaces, apostrophes or final period:
// "To drive." and "drive" are the same word, "the couch" is couch.
export function englishKey(text: string) {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[.!?]+\s*$/, "")
    .replace(/^\s*(to|the|a|an)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}
