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

// How each French tense is formed and used, and how it is usually translated into
// American English. Small models mix tenses up (e.g. a subjonctif without "que"),
// and one French tense can give several English ones.
export const TENSE_GUIDES: Record<(typeof TENSES)[number], string> = {
  présent:
    "action now, a habit or a general truth (je mange); English: simple present or present continuous, " +
    "but present perfect with depuis, ça fait … que or il y a … que " +
    "(j'habite ici depuis 2010 → I have lived here since 2010), " +
    "and just + present perfect for venir de (je viens de manger → I've just eaten)",
  "passé composé":
    "completed past action, avoir/être + participle (j'ai mangé, elle est partie); " +
    "English: simple past, always with a finished time (hier, en 2010), or present perfect " +
    "for an experience or a result with no time given " +
    "(j'ai déjà vu ce film → I've already seen this movie, or I already saw it)",
  imparfait:
    "past description, state, habit or ongoing action (je mangeais); English: simple past " +
    "for a state or after si (j'étais fatigué → I was tired), past continuous for an ongoing " +
    "action (I was eating), used to or would for a habit",
  "plus-que-parfait": "past before another past, avoir/être in the imparfait + participle (j'avais mangé); English: past perfect (had eaten)",
  "futur simple":
    "future, one word (je mangerai); English: will + verb, but simple present after " +
    "when, as soon as, until, before or after (quand il arrivera → when he arrives)",
  "futur proche": "near future, aller + infinitive (je vais manger); English: be going to + verb",
  "conditionnel présent":
    "hypothesis or politeness (je mangerais, si j'avais faim je mangerais); English: would + verb " +
    "(could for pouvoir, should for devoir), with a simple past after if " +
    "(si j'avais le temps → if I had time)",
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
