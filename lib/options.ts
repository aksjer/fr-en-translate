// Exercise options the user can multi-select in the settings panel.

export const MODES = [
  "mot",
  "verbe",
  "phrasal verb",
  "phrase",
  "paragraphe",
] as const;

export const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

// What each CEFR level means, for the prompts: small models don't know it well.
export const LEVEL_DESCRIPTIONS: Record<(typeof LEVELS)[number], string> = {
  A1: "very common everyday words, short simple sentences (5 to 8 words), present tense mostly",
  A2: "common words about daily life, simple sentences (6 to 10 words), basic connectors (et, mais, parce que)",
  B1: "everyday and work vocabulary, sentences of 8 to 15 words, one subordinate clause at most",
  B2: "varied vocabulary including some abstract words, sentences of 12 to 20 words with subordinate clauses",
  C1: "rich and precise vocabulary, idiomatic expressions, complex sentences with nuance",
  C2: "sophisticated, literary or idiomatic French, long sentences with subtle nuance",
};

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

// How each French tense is formed and used, and its usual American English
// equivalent: small models often mix them up (e.g. a subjonctif without "que").
export const TENSE_GUIDES: Record<(typeof TENSES)[number], string> = {
  présent: "action now or a habit (je mange); English: simple present or present continuous",
  "passé composé": "completed past action, avoir/être + participle (j'ai mangé, elle est partie); English: simple past or present perfect",
  imparfait: "past description, habit or ongoing action (je mangeais); English: was doing, used to do or would do",
  "plus-que-parfait": "past before another past, avoir/être in the imparfait + participle (j'avais mangé); English: past perfect (had eaten)",
  "futur simple": "future, one word (je mangerai); English: will + verb",
  "futur proche": "near future, aller + infinitive (je vais manger); English: be going to + verb",
  "conditionnel présent": "hypothesis or politeness (je mangerais, si j'avais faim je mangerais); English: would + verb",
  "subjonctif présent": "after que with a wish, need, feeling or doubt (il faut que je mange, je veux qu'il vienne); English: often an infinitive (I need to eat, I want him to come) or a base verb",
  impératif: "an order or advice with no subject (mange !, allons-y, ne partez pas); English: base verb with no subject (Eat!, Let's go, Don't leave)",
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
