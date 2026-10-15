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

export const TENSES = [
  "present",
  "compound past",
  "imperfect",
  "pluperfect",
  "simple future",
  "near future",
  "present conditional",
  "present subjunctive",
  "imperative",
] as const;

// How each French tense is usually translated into American English. Small
// models mix tenses up, and one French tense can give several English ones.
export const TENSE_GUIDES: Record<(typeof TENSES)[number], string> = {
  present:
    "simple present or present continuous, but present perfect with depuis " +
    "(j'habite ici depuis 2010 → I have lived here since 2010) and just + present " +
    "perfect or, very often in American English, just + simple past for venir de " +
    "(je viens de finir → I just finished)",
  "compound past":
    "simple past with a finished time (hier, en 2010), or present perfect for an " +
    "experience or a result with no time given, where American English often uses " +
    "the simple past too (j'ai perdu mes clés → I lost my keys)",
  imperfect:
    "simple past for a state, past continuous for an ongoing action, used to or would " +
    "for a habit",
  pluperfect: "past perfect (had eaten)",
  "simple future": "will + verb, but simple present after when, as soon as, until (quand il arrivera → when he arrives)",
  "near future": "be going to + verb",
  "present conditional": "would + verb (could for pouvoir, should for devoir), with a simple past after if",
  "present subjunctive": "after que (il faut que, je veux que); often an infinitive (I need to eat, I want him to come)",
  imperative: "base verb with no subject (Eat!, Let's go, Don't leave)",
};

// The lowest English level each tense fits, from the English it needs (the simple
// past at A2, would and the past perfect at B1). Only used when the learner
// selects no tense: a tense they select is always used.
export const TENSE_LEVELS: Record<
  (typeof TENSES)[number],
  (typeof LEVELS)[number]
> = {
  present: "A1",
  imperative: "A1",
  "compound past": "A2",
  imperfect: "A2",
  "simple future": "A2",
  "near future": "A2",
  "present conditional": "B1",
  "present subjunctive": "B1",
  pluperfect: "B1",
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
