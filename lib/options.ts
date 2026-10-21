// Exercise options the user can multi-select in the settings panel.

export const MODES = ["word", "verb", "sentence"] as const;

// How long Gemini thinks before it answers: always minimal in the app; the
// evals can try the others.
export const EFFORTS = ["minimal", "low", "medium", "high"] as const;
export type Effort = (typeof EFFORTS)[number];

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
// "you should have" and "you should've" → should have, without the context in
// parentheses.
export function englishKey(reference: string) {
  return reference
    .toLowerCase()
    // Curly apostrophes, the default on phones and Macs: can’t is can't.
    .replace(/[’‘]/g, "'")
    .replace(/\([^)]*\)/g, " ")
    // "a little" and "a few" keep their a: little (peu) isn't a little (un peu).
    .replace(/^\s*(to|the|a(?!\s+(little|few|lot|bit)\b)|an)\s+/, "")
    // Contracted forms written in full: should've, you'd better, you'll.
    .replace(/'ve\b/g, " have")
    .replace(/^(i|you|he|she|it|we|they)'d(?=\s+better\b)/, "$1 had")
    .replace(/^(i|you|he|she|it|we|they)'d\b/, "$1 would")
    .replace(/^(i|you|he|she|it|we|they)'ll\b/, "$1 will")
    // A modal answered with its subject (« tu aurais dû »).
    .replace(
      /^(i|you|he|she|it|we|they)\s+(?=(can|could|should|must|might|may|will|would|ought|need|have|has|had|don't|doesn't|didn't|can't|couldn't|shouldn't|won't|wouldn't|mustn't)\b)/,
      "",
    )
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

// What each English tense looks like: with examples for the correction
// (english), as forms only for the generation (forms), so it has no
// sentence to copy; and the French that leads to it, for the generation.
export const TENSE_GUIDES: Record<
  (typeof TENSES)[number],
  { english: string; forms: string; french: string }
> = {
  present: {
    english: "simple present or present continuous (I work, I'm working)",
    forms: "the simple present, or the present continuous for an action going on now",
    french: "a présent without depuis (with depuis, English needs the present perfect)",
  },
  past: {
    english:
      "simple past or past continuous (I worked, I was working), or used to for a past " +
      "habit; American English also uses the simple past for a recent result and with " +
      "already or yet (I lost my keys, I already ate, Did you eat yet?)",
    forms:
      "the simple past, the past continuous for an action in progress, or used to + verb " +
      "for a past habit",
    french:
      "a passé composé of a finished action, often with a finished time, or an " +
      "imparfait: of an action in progress for the past continuous, of a habit for the " +
      "simple past or used to",
  },
  "present perfect": {
    english:
      "have + past participle (I have worked), or have been + -ing for an ongoing " +
      "activity (I've been waiting for an hour)",
    forms: "have or has + past participle, or have been + -ing for an ongoing activity",
    french:
      "a présent with depuis, ça fait … que or il y a + a duration + que, or a passé " +
      "composé with jamais, plusieurs fois, pas encore, or déjà meaning once in one's " +
      "life, with no finished time, which makes it a simple past. Not déjà meaning " +
      "already, often a simple past in American English. Without such a word, a passé " +
      "composé is a simple past, so never use one alone",
  },
  "past perfect": {
    english:
      "had + past participle (I had worked); the simple past is also natural when after " +
      "or before already shows the order (after he left)",
    forms: "had + past participle",
    french:
      "a plus-que-parfait, in a sentence where the order of two past events matters and " +
      "no après or avant shows it",
  },
  future: {
    english:
      "will or be going to + verb (I will work, I'm going to work), with a simple present " +
      "after when, as soon as or until (when he arrives, not when he will arrive)",
    forms: "will or be going to + verb, with a simple present after when, as soon as or until",
    french: "a futur simple or futur proche; English puts a futur after quand in the present",
  },
  conditional: {
    english:
      "would + verb (I would work; could, should), with a simple past after if (if I had " +
      "time, I would go)",
    forms: "would, could or should + verb, with a simple past after if",
    french: "a conditionnel présent; pouvoir gives could and devoir gives should",
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

// The same French text, whatever its case, spaces, quotes or apostrophes.
export function sameText(text: string) {
  return text
    .toLowerCase()
    .replace(/[«»"]/g, "")
    .replace(/’/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
