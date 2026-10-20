// Exercise options the user can multi-select in the settings panel.

export const MODES = ["word", "verb", "sentence"] as const;

// The longest item or answer, in characters. The answer box, the generated item
// and the correction share it, so anything generated can be corrected.
export const MAX_TEXT_LENGTH = 1000;

// Items the learner got right are sent back so they never come again: at most
// this many per mode, the most recent ones. The prompt lists them, and the code
// still checks them, since a long list isn't always followed.
export const MAX_KNOWN = 2000;

// The recent exercises sent with their results: the last ones of each mode,
// since the server picks the mode. The prompt gets those of its mode.
export const HISTORY_PER_MODE = 200;
export const MAX_HISTORY = HISTORY_PER_MODE * MODES.length;

// The oldest missed or left unanswered words and verbs sent for a review, per mode.
export const MAX_REVIEW = 50;

// The learner's last mistakes in a mode, sent to the correction so it can say
// when one comes back.
export const MAX_PAST_MISTAKES = 50;

// Grammar points of sentences: mastered after this many right answers on
// different days, and how many of each list the prompt gets.
export const POINT_MASTERY = 2;
export const MAX_POINTS = 500;
export const MAX_POINTS_TO_PRACTICE = 30;

// A grammar point's name, the same whatever the model adds: "Should (advice)",
// "should + verb" and "should." are all should.
export function pointName(point: string) {
  return point
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    // "as soon as + present" is as soon as.
    .replace(/\s*\+.*$/, "")
    .replace(/["«»“”]/g, "")
    .replace(/[.,;:!?]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

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

// What each English tense looks like, for both prompts, and the French that
// leads to it, for generation only.
export const TENSE_GUIDES: Record<
  (typeof TENSES)[number],
  { english: string; french: string }
> = {
  present: {
    english: "simple present or present continuous (I work, I'm working)",
    french: "a présent without depuis (with depuis, English needs the present perfect)",
  },
  past: {
    english:
      "simple past or past continuous (I worked, I was working), or used to for a past " +
      "habit; American English also uses the simple past for a recent result and with " +
      "already or yet (I lost my keys, I already ate, Did you eat yet?)",
    french:
      "a passé composé of a finished action, often with a finished time (hier, en 2010), " +
      "or an imparfait: of an action in progress for the past continuous, of a habit for " +
      "the simple past or used to (je jouais au foot le dimanche → I used to play soccer " +
      "on Sundays)",
  },
  "present perfect": {
    english:
      "have + past participle (I have worked), or have been + -ing for an ongoing " +
      "activity (I've been waiting for an hour)",
    french:
      "a présent with depuis, ça fait … que or il y a + a duration + que (j'habite ici " +
      "depuis 2010 → I have lived here since 2010; ça fait une heure que j'attends → I've " +
      "been waiting for an hour), or a passé composé with jamais, plusieurs fois, pas " +
      "encore, or déjà meaning once in one's life (j'ai déjà été à New York → I've been " +
      "to New York; as-tu déjà vu… ? → have you ever seen…?), with no finished time (hier, " +
      "la semaine dernière, en 2020), which makes it a simple past. Not déjà meaning " +
      "already: j'ai déjà mangé is often I already ate in American English. Without such a word, a passé " +
      "composé is a simple past (j'ai mangé une pomme → I ate an apple), so never use one alone",
  },
  "past perfect": {
    english:
      "had + past participle (I had worked); the simple past is also natural when after " +
      "or before already shows the order (after he left)",
    french:
      "a plus-que-parfait, in a sentence where the order of two past events matters and " +
      "no après or avant shows it",
  },
  future: {
    english:
      "will or be going to + verb (I will work, I'm going to work), with a simple present " +
      "after when, as soon as or until (when he arrives, not when he will arrive)",
    french: "a futur simple or futur proche (quand il arrivera → when he arrives)",
  },
  conditional: {
    english:
      "would + verb (I would work; could, should), with a simple past after if (if I had " +
      "time, I would go)",
    french: "a conditionnel présent (could for pouvoir, should for devoir)",
  },
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
  "news",
  "cars and EVs",
  "movies and TV shows",
] as const;

// The kinds of words the learner practices. A word item is one of them, except
// an auxiliary, which has no French word of its own; a sentence needs one of
// the grammar ones.
export const WORD_TYPES = [
  "noun",
  "adjective",
  "adverb",
  "modal",
  "preposition",
  "conjunction",
  "auxiliary",
] as const;
export const WORD_KINDS = [
  "noun",
  "adjective",
  "adverb",
  "modal",
  "preposition",
  "conjunction",
] as const satisfies readonly WordType[];
export const SENTENCE_FOCUSES = [
  "auxiliary",
  "modal",
  "preposition",
  "conjunction",
  "adverb",
] as const satisfies readonly WordType[];

export type Mode = (typeof MODES)[number];

// A single word or verb, as opposed to a sentence.
export function isWordMode(mode: Mode) {
  return mode === "word" || mode === "verb";
}
export type Tense = (typeof TENSES)[number];
export type VerbType = (typeof VERB_TYPES)[number];
export type Theme = (typeof THEMES)[number];

// How common the model says an English word or verb is, stored with the item.
export const FREQUENCIES = ["everyday", "sometimes", "rare"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export type WordType = (typeof WORD_TYPES)[number];
export type WordKind = (typeof WORD_KINDS)[number];
export type SentenceFocus = (typeof SENTENCE_FOCUSES)[number];

// Which settings apply to each mode; the others are ignored for that mode.
export const MODE_USES = {
  word: { tense: false, verbType: false, theme: true, wordType: true },
  verb: { tense: false, verbType: true, theme: true, wordType: false },
  sentence: { tense: true, verbType: false, theme: true, wordType: true },
} satisfies Record<
  Mode,
  { tense: boolean; verbType: boolean; theme: boolean; wordType: boolean }
>;
