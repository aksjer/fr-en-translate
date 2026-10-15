// The kinds of mistakes French speakers make in English. The correction files
// each mistake under one, and the history keeps it for the learner's weak points.
export const ERROR_TAGS = [
  "meaning",
  "false friend",
  "tense",
  "preposition",
  "article",
  "word order",
  "vocabulary",
  "grammar",
  "spelling",
  "punctuation",
  "other",
] as const;

export type ErrorTag = (typeof ERROR_TAGS)[number];

// What each tag covers, for the prompts: the correction files every mistake
// under the right one, and generation reads the learner's weak points.
export const ERROR_TAG_DEFINITIONS: Record<ErrorTag, string> = {
  meaning: "the meaning is wrong, missing or added, or an idiom is translated word for word",
  "false friend": "a false friend (actually for actuellement, library for librairie)",
  tense: "a wrong tense (I have seen him yesterday)",
  preposition: "a wrong, missing or extra preposition (depend of)",
  article: "a wrong, missing or extra article (she is nurse, the life is beautiful)",
  "word order": "a wrong word order (a car red)",
  vocabulary: "a wrong or unnatural word (make my homework)",
  grammar:
    "any other grammar mistake: agreement, third person -s, verb forms (eated), " +
    "plurals (advices), questions and negations with do",
  spelling: "spelling, British spelling included (colour)",
  punctuation: "punctuation and capital letters",
  other: "anything else",
};
