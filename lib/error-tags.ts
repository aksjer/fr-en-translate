// The kinds of mistakes French speakers make in English. The correction files
// each mistake under one, and the history keeps it for the learner's weak points.
export const ERROR_TAGS = [
  "sens",
  "faux ami",
  "temps",
  "préposition",
  "article",
  "ordre des mots",
  "vocabulaire",
  "grammaire",
  "orthographe",
  "ponctuation",
  "autre",
] as const;

export type ErrorTag = (typeof ERROR_TAGS)[number];

// What each tag covers, for the prompts: the correction files every mistake
// under the right one, and generation reads the learner's weak points.
export const ERROR_TAG_DEFINITIONS: Record<ErrorTag, string> = {
  sens: "the meaning is wrong, missing or added, or an idiom is translated word for word",
  "faux ami": "a false friend (actually for actuellement, library for librairie)",
  temps: "a wrong tense (I have seen him yesterday)",
  préposition: "a wrong, missing or extra preposition (depend of)",
  article: "a wrong, missing or extra article (she is nurse, the life is beautiful)",
  "ordre des mots": "a wrong word order (a car red)",
  vocabulaire:
    "a wrong or unnatural word (make my homework), or a simple verb instead of a phrasal verb",
  grammaire:
    "any other grammar mistake: agreement, third person -s, verb forms (eated), " +
    "plurals (advices), questions and negations with do",
  orthographe: "spelling, British spelling included (colour)",
  ponctuation: "punctuation and capital letters",
  autre: "anything else",
};
