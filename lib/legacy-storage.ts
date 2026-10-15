// The values the first version of the app saved in the browser, in French,
// and today's English ones. Settings, history and learned items saved before
// the switch to English are read through this, so nothing is lost.
// Once every browser has saved again in English, this file can go.
const LEGACY_VALUES: Record<string, string> = {
  // Modes
  mot: "word",
  verbe: "verb",
  phrase: "sentence",
  // Tenses
  présent: "present",
  "passé composé": "compound past",
  imparfait: "imperfect",
  "plus-que-parfait": "pluperfect",
  "futur simple": "simple future",
  "futur proche": "near future",
  "conditionnel présent": "present conditional",
  "subjonctif présent": "present subjunctive",
  impératif: "imperative",
  // Verb types
  régulier: "regular",
  irrégulier: "irregular",
  // Themes
  "vie quotidienne": "daily life",
  travail: "work",
  voyage: "travel",
  nourriture: "food",
  loisirs: "hobbies",
  santé: "health",
  "famille et amis": "family and friends",
  technologie: "technology",
  // Mistake categories
  sens: "meaning",
  "faux ami": "false friend",
  temps: "tense",
  préposition: "preposition",
  "ordre des mots": "word order",
  vocabulaire: "vocabulary",
  grammaire: "grammar",
  orthographe: "spelling",
  ponctuation: "punctuation",
  autre: "other",
};

// Today's value for one saved value; anything else is returned as is.
export function fromLegacy<T>(value: T): T {
  return typeof value === "string" && Object.hasOwn(LEGACY_VALUES, value)
    ? (LEGACY_VALUES[value] as T)
    : value;
}
