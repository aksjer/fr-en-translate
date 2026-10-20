// One French sentence whose translation needs the English tense from the settings.
import { ERROR_TAG_DEFINITIONS, ERROR_TAGS, type ErrorTag } from "@/lib/error-tags";
import { COMMON_ENGLISH, generateItem, type GenerateInput } from "@/lib/generate/shared";
import { TENSE_GUIDES, type SentenceFocus, type Theme } from "@/lib/options";
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

// Sentences get the same rule as words, so they use useful English.
const SENTENCE_VOCABULARY = `\nIts American English translation uses only words ${COMMON_ENGLISH}.`;

// What each grammar point means in a sentence, so the French needs it.
const FOCUS_GUIDES: Record<SentenceFocus, string> = {
  auxiliary:
    "an English auxiliary the French doesn't show word for word: do, does or did in a " +
    "question or a negation, have in a perfect tense, be in a continuous tense, or will",
  modal: "an English modal (can, could, should, must, might, would, have to)",
  preposition:
    "an English preposition that French speakers often get wrong (on Monday, at night, " +
    "for two years, depend on, wait for, in the car)",
  conjunction:
    "an English conjunction or linking word (although, unless, while, as soon as, so, " +
    "because, whereas)",
  adverb:
    "a common English adverb and its place in the sentence (already, still, yet, ever, " +
    "always, just, almost)",
};

// How a sentence on these themes sounds, from what the learner reads and
// watches. The words stay everyday ones: the learner wants to speak, not to
// write articles.
const THEME_STYLES: Partial<Record<Theme, string>> = {
  news:
    "Write it like a short line from a news story, in everyday words: a fact, often " +
    "with someone reporting it (« Le maire a dit que… », « Selon la police… ») or with " +
    "what is expected next.",
  "cars and EVs":
    "Write it like a line from a first-person car review or a talk between drivers: " +
    "casual, in everyday words, often with a common expression (« Je n'ai pas pu " +
    "m'empêcher de… », « Ça n'a pas vraiment marché », « L'autonomie a largement " +
    "dépassé… »), about driving, charging, range, the battery or the price.",
  "movies and TV shows":
    "Write it like a line of dialogue from a movie or a TV show, or what a friend says " +
    "about one: short and natural.",
};

// One learning point besides the tense: a sentence with several difficulties
// is hard to learn from, and the correction mixes them up. The code picks a
// grammar point for most sentences; the others practice a recent mistake
// (more precise than a weak point's category) or a weak point.
function learningPoint(focus?: SentenceFocus) {
  return focus
    ? "\n\n## Learning point\nThe tense is the main point of the sentence. Its natural " +
        `translation must also need ${FOCUS_GUIDES[focus]}, without pointing it out. ` +
        "Never more than this one other point: a sentence with several difficulties is " +
        "hard to learn from."
    : "\n\n## Learning point\nThe tense is the main point of the sentence. Add at most " +
        "one other point, the first of these that fits the tense, without pointing it out:\n" +
        "1. the difficulty of a wrong item marked (recent) in the history, when its remark " +
        "names it;\n" +
        "2. else one of the weak points below, if any;\n" +
        "3. else one common word or phrase that French speakers often get wrong.\n" +
        "Never more than one: a sentence with several difficulties is hard to learn from.";
}

// The model invents the situation itself; this keeps it from always falling
// back on the most typical sentence for the theme.
const VARIETY =
  "\n\n## Variety\nInvent a specific, concrete situation on this theme that could " +
  "happen in real life: decide who is involved, where and when. Avoid the most " +
  "obvious example for the theme (going to the market, today's weather…), " +
  "but stay realistic: no science fiction or fantasy. Write what a French speaker " +
  "would really say in that situation. Use another structure, person and sentence type " +
  "than the last sentences of the history (not « Tu ne … pas … en ce moment » again " +
  "and again).";

const PRIORITY =
  "\n\n## Priority\nIf two instructions conflict, the tense and the theme come first, " +
  "then common words, then the learning point, then the variety.";

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
        "\nOne of these can be the extra learning point (see Learning point)."
    : "";
}

export function generateSentence(input: GenerateInput, combination: Combination) {
  const { focus, tense, theme } = combination;
  return generateItem(input, combination, {
    // Planning the verb first keeps the tense right.
    fields: [
      "- situation: first, one short line in English: the situation you chose (who, where,",
      `  when), then the main verb of the English translation in the ${tense}, and the`,
      "  French verb as it will appear in the sentence.",
      ...SENTENCE_TEXT_FIELD,
      "- reference: the most natural American English translation of text, in the tense a",
      `  native speaker would use for this French. It must be the ${tense}: if it isn't`,
      "  natural, change the French, not the tense. Use American words and spelling",
      "  (apartment, color, not flat, colour).",
    ],
    task:
      `Write one original French sentence on the theme "${theme}", as long as a line in ` +
      "a conversation, a video or a news story, whose natural American English " +
      `translation is in the ${tense}: ` +
      `${tense && TENSE_GUIDES[tense].english}. ` +
      `To get it, use ${tense && TENSE_GUIDES[tense].french}. ` +
      "Choose the person of the main verb (je, tu, il, elle, on, nous, vous, ils or " +
      "elles) and the sentence type (statement, question or negation; an exclamation only " +
      "when the situation calls for one)." +
      SENTENCE_VOCABULARY +
      (theme && THEME_STYLES[theme] ? ` ${THEME_STYLES[theme]}` : "") +
      learningPoint(focus) +
      VARIETY +
      PRIORITY,
    // Weak points only matter when the code picked no grammar point.
    sections: focus ? "" : weakPointsSection(input),
  });
}
