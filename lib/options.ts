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

// The English each CEFR level needs, for the generation prompt. The learner is
// French, so the level is about the English they must write, not the French.
export const LEVEL_VOCABULARY: Record<(typeof LEVELS)[number], string> = {
  A1: "very common words",
  A2: "common everyday words",
  B1: "everyday and work vocabulary",
  B2: "varied vocabulary",
  C1: "precise vocabulary and idioms",
  C2: "subtle register and nuance, rare idioms",
};

export const LEVEL_GRAMMAR: Record<(typeof LEVELS)[number], string> = {
  A1: "simple present, present continuous, can, there is / are",
  A2: "simple past, going to, comparatives, some / any",
  B1: "present perfect vs simple past, used to, first and second conditional, common phrasal verbs",
  B2: "passive, third conditional, reported speech, modals of deduction (must be, can't be)",
  C1: "less common phrasal verbs, past modals (should have, might have), mixed conditionals",
  C2: "formal structures such as inversion",
};

// How many words a sentence has at each level.
export const SENTENCE_WORDS: Record<(typeof LEVELS)[number], string> = {
  A1: "5 to 8",
  A2: "6 to 10",
  B1: "8 to 15",
  B2: "12 to 20",
  C1: "15 to 30",
  C2: "20 to 35",
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
