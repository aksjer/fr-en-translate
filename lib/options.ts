// Exercise options the user can multi-select in the settings panel.

export const MODES = [
  "mot",
  "verbe",
  "phrasal verb",
  "phrase",
  "paragraphe",
] as const;

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

// How each French tense is usually translated into American English. Small
// models mix tenses up, and one French tense can give several English ones.
export const TENSE_GUIDES: Record<(typeof TENSES)[number], string> = {
  présent:
    "simple present or present continuous, but present perfect with depuis " +
    "(j'habite ici depuis 2010 → I have lived here since 2010) and just + present " +
    "perfect for venir de",
  "passé composé":
    "simple past with a finished time (hier, en 2010), or present perfect for an " +
    "experience or a result with no time given",
  imparfait:
    "simple past for a state, past continuous for an ongoing action, used to or would " +
    "for a habit",
  "plus-que-parfait": "past perfect (had eaten)",
  "futur simple": "will + verb, but simple present after when, as soon as, until (quand il arrivera → when he arrives)",
  "futur proche": "be going to + verb",
  "conditionnel présent": "would + verb (could for pouvoir, should for devoir), with a simple past after if",
  "subjonctif présent": "after que (il faut que, je veux que); often an infinitive (I need to eat, I want him to come)",
  impératif: "base verb with no subject (Eat!, Let's go, Don't leave)",
};

// The lowest English level each tense fits, from the English it needs (the simple
// past at A2, would and the past perfect at B1). Only used when the learner
// selects no tense: a tense they select is always used.
export const TENSE_LEVELS: Record<
  (typeof TENSES)[number],
  (typeof LEVELS)[number]
> = {
  présent: "A1",
  impératif: "A1",
  "passé composé": "A2",
  imparfait: "A2",
  "futur simple": "A2",
  "futur proche": "A2",
  "conditionnel présent": "B1",
  "subjonctif présent": "B1",
  "plus-que-parfait": "B1",
};

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

// A single word or verb, as opposed to a sentence or a paragraph.
export function isWordMode(mode: Mode) {
  return mode === "mot" || mode === "verbe" || mode === "phrasal verb";
}
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
  paragraphe: { tense: false, verbType: false, theme: true },
} satisfies Record<Mode, { tense: boolean; verbType: boolean; theme: boolean }>;
