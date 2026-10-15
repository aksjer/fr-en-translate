// Exercise options the user can multi-select in the settings panel.

export const MODES = ["word", "verb", "sentence"] as const;

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

// The longest item or answer, in characters. The answer box, the generated item
// and the correction share it, so anything generated can be corrected.
export const MAX_TEXT_LENGTH = 1000;

// Items the learner got right are sent back so they never come again: at most
// this many per mode, the most recent ones.
export const MAX_KNOWN = 1000;

// The recent exercises sent with their results, all modes together: the
// server keeps the last ones of the mode it picks.
export const MAX_HISTORY = 100;

// The English an item is known by: "to wear" → wear, "the couch" → couch,
// without the context in parentheses.
export function englishKey(reference: string) {
  return reference
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/^\s*(to|the|a|an)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// The English tenses the learner practices: the French sentence is written so
// its natural translation needs this tense.
export const TENSES = [
  "present",
  "past",
  "present perfect",
  "past perfect",
  "future",
  "conditional",
] as const;

// What each English tense covers, and the French that usually leads to it.
export const TENSE_GUIDES: Record<(typeof TENSES)[number], string> = {
  present:
    "simple present or present continuous (I work, I'm working), from a French présent",
  past:
    "simple past or past continuous (I worked, I was working), from a passé composé " +
    "with a finished time (hier, en 2010) or an imparfait; American English also uses " +
    "it for a recent result (j'ai perdu mes clés → I lost my keys)",
  "present perfect":
    "have + past participle (I have worked), from a présent with depuis (j'habite ici " +
    "depuis 2010 → I have lived here since 2010) or a passé composé for an experience " +
    "with no time given (je n'ai jamais vu la mer → I have never seen the ocean)",
  "past perfect": "had + past participle (I had worked), from a plus-que-parfait",
  future:
    "will or be going to + verb (I will work, I'm going to work), from a futur simple " +
    "or futur proche, with a simple present after when or as soon as (quand il " +
    "arrivera → when he arrives)",
  conditional:
    "would + verb (I would work; could for pouvoir, should for devoir), from a " +
    "conditionnel présent, with a simple past after if",
};

// The lowest English level each tense fits. Only used when the learner selects
// no tense: a tense they select is always used.
export const TENSE_LEVELS: Record<
  (typeof TENSES)[number],
  (typeof LEVELS)[number]
> = {
  present: "A1",
  past: "A2",
  "present perfect": "A2",
  future: "A2",
  conditional: "B1",
  "past perfect": "B1",
};

// Regular or irregular in English, since that's what the learner must produce.
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
] as const;

export type Mode = (typeof MODES)[number];

// A single word or verb, as opposed to a sentence.
export function isWordMode(mode: Mode) {
  return mode === "word" || mode === "verb";
}
export type Level = (typeof LEVELS)[number];
export type Tense = (typeof TENSES)[number];
export type VerbType = (typeof VERB_TYPES)[number];
export type Theme = (typeof THEMES)[number];

// Which settings apply to each mode; the others are ignored for that mode.
export const MODE_USES = {
  word: { tense: false, verbType: false, theme: true },
  verb: { tense: false, verbType: true, theme: false },
  sentence: { tense: true, verbType: false, theme: true },
} satisfies Record<Mode, { tense: boolean; verbType: boolean; theme: boolean }>;
