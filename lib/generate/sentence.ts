// One French sentence in the tense from the settings.
import { ERROR_TAG_DEFINITIONS, ERROR_TAGS, type ErrorTag } from "@/lib/error-tags";
import { generateItem, type GenerateInput } from "@/lib/generate/shared";
import { TENSE_GUIDES, type Level } from "@/lib/options";
import type { Combination } from "@/lib/settings";

// The text field. "As people speak it today" gave slang and negations
// without « ne »; "correct French" alone gave literary French. "No quotes" may have made models drop apostrophes (« l avion »).
const SENTENCE_TEXT_FIELD = [
  "- text: the item, in correct, modern French with a neutral register: no slang,",
  "  swear words or literary style, always the « ne » of a negation, and no literary",
  "  tense (the French simple past or imperfect subjunctive). Use French punctuation",
  "  (a space before ! ? : ;) and apostrophes (j'ai, qu'il), with no quotation marks around the item",
  "  and no translation or explanation. Check the spelling and accents of every word.",
];

// Sentences get the same frequency lists as words, so they use useful English.
function sentenceVocabulary(level: Level) {
  return (
    "\nBuild it so its American English translation uses common words (Oxford 5000, COCA) " +
    `at or below CEFR ${level}, plus one or two words or one structure typical of ` +
    `${level}, so it teaches something new.`
  );
}

// The model invents the situation itself; this keeps it from always falling
// back on the most typical sentence for the theme.
const VARIETY =
  "\n\n## Variety\nInvent a specific, concrete situation on this theme that could " +
  "happen in real life: decide who is involved, where and when. Avoid the most " +
  "obvious example for the theme (going to the market, today's weather…), " +
  "but stay realistic: no science fiction or fantasy.";

const PRIORITY =
  "\n\n## Priority\nIf two instructions conflict, the tense and the theme come first, " +
  "then the level, then the variety.";

// Spelling, punctuation and "anything else" can't be built into a sentence.
const UNPRACTICED_TAGS: ErrorTag[] = ["spelling", "punctuation", "other"];

// The kinds of mistakes the learner made most in their recent sentences.
// Recent answers only, so a point they have fixed drops out by itself.
// Not from words: a missed word already comes back, and its usual tag (meaning)
// can't be built into a sentence.
function weakPointsSection(input: GenerateInput) {
  const counts = new Map<ErrorTag, number>();
  for (const item of input.history ?? []) {
    if (item.mode !== "sentence") continue;
    const tag = ERROR_TAGS.find((known) => known === item.tag);
    if (item.ok === false && tag && !UNPRACTICED_TAGS.includes(tag)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const top = [...counts]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  return top.length
    ? "\n\n## Weak points\n" +
        "The kinds of mistakes the learner made most in their recent sentences:\n" +
        top.map(([tag, count]) => `- ${ERROR_TAG_DEFINITIONS[tag]}: ${count} times`).join("\n") +
        "\nBuild the item so its translation practices one of these points, without " +
        "pointing it out."
    : "";
}

export function generateSentence(input: GenerateInput, combination: Combination) {
  const { level, tense, theme } = combination;
  const imperative = tense === "imperative";
  return generateItem(input, combination, {
    // Planning the conjugated verb first keeps the tense right.
    fields: [
      "- situation: first, one short line in English: the situation you chose (who, where,",
      `  when), then the main French verb, already conjugated in the ${tense} and in the`,
      "  person you chose.",
      ...SENTENCE_TEXT_FIELD,
    ],
    task:
      `Write one original French sentence on the theme "${theme}", ` +
      `in the French ${tense}, of a length typical of CEFR ${level}. ` +
      "Choose the person of the main verb " +
      (imperative
        ? "(tu, nous or vous) and whether it is a statement or a negation."
        : "(je, tu, il, elle, on, nous, vous, ils or elles) and the sentence type " +
          "(statement, question, negation or exclamation).") +
      sentenceVocabulary(level) +
      "\n" +
      `This tense in American English: ${tense && TENSE_GUIDES[tense]}.` +
      VARIETY +
      PRIORITY,
    sections: weakPointsSection(input),
  });
}
