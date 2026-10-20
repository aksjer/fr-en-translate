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
const SENTENCE_VOCABULARY = `\nIts American English translation uses only words ${COMMON_ENGLISH}`;

// What each grammar point means in a sentence, so the French needs it.
const FOCUS_GUIDES: Record<SentenceFocus, string> = {
  auxiliary:
    "an English auxiliary the French doesn't show word for word: do, does or did in a " +
    "question or a negation, a short answer (Yes, I have) or a question tag (didn't you?)",
  modal: "an English modal (can, could, should, must, might, have to)",
  preposition:
    "an English preposition that French speakers often get wrong (on Monday, at night, " +
    "for two years, depend on, wait for, in the car)",
  conjunction:
    "an English conjunction or linking expression (although, unless, while, as soon " +
    "as, as well as, as long as, even though, so that, whereas)",
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
    "with its source (« Selon la police… », « D'après le maire… ») or with what is " +
    "expected next, with its main verb in the tense asked for.",
  "cars and EVs":
    "Write it like a line from a first-person car review or a talk between drivers: " +
    "casual, in everyday words, about driving, charging, range, the battery or the price. " +
    "A common expression (« ne pas pouvoir s'empêcher de », « dépasser largement ») only " +
    "when it is the learning point.",
  "movies and TV shows":
    "Write it like a line of dialogue from a movie or a TV show, or what a friend says " +
    "about one: short and natural.",
};

// The point is never the word the tense already needs: with the future, will
// gave no other point.
const OTHER_THAN_TENSE =
  "The point is never the plain auxiliary the tense itself needs (will for the " +
  "future, would for the conditional, have or had for a perfect tense, be in a " +
  "continuous tense), though a question tag or a short answer may use it (haven't " +
  "you?, Yes, I will). Combine the point with the tense in its natural form (will " +
  "have to, has had to, hasn't been able to); if a point doesn't fit the tense, " +
  "choose another one of the same kind.";

// One learning point besides the tense: a sentence with several difficulties
// is hard to learn from, and the correction mixes them up. The code picks a
// grammar point for most sentences; the others practice a recent mistake
// (more precise than a weak point's category) or a weak point.
function learningPoint(focus?: SentenceFocus, retest?: boolean) {
  if (retest) {
    return (
      "\n\n## Learning point\nThe tense is the main point of the sentence. This " +
      "sentence retests the learner's last wrong sentence (the last wrong line of the history): " +
      "its natural translation must need the same difficulty as that mistake again, in " +
      "a new situation, without pointing it out. Never more than this one other point."
    );
  }
  return focus
    ? "\n\n## Learning point\nThe tense is the main point of the sentence. Its natural " +
        `translation must also need ${FOCUS_GUIDES[focus]}, without pointing it out. ` +
        `${OTHER_THAN_TENSE} ` +
        "Never more than this one other point: a sentence with several difficulties is " +
        "hard to learn from."
    : "\n\n## Learning point\nThe tense is the main point of the sentence. Add at most " +
        "one other point, the first of these that fits the tense, without pointing it out:\n" +
        "1. the difficulty of a wrong item marked (recent) in the history, when its remark " +
        "names it, the last one first: test the same difficulty again in a new sentence;\n" +
        "2. else one of the weak points below, if any;\n" +
        "3. else one common word or phrase that French speakers often get wrong.\n" +
        `${OTHER_THAN_TENSE} ` +
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
  "then common words, then the learning point, then the words being learned, then the " +
  "variety.";

// The words and verbs met in the other modes, so sentences use them again in
// a new context: words seen in several contexts are remembered better.
const MAX_WORDS_TO_REUSE = 15;

function wordsSection(input: GenerateInput) {
  const words = new Map<string, string>();
  for (const item of [...(input.history ?? [])].reverse()) {
    if ((item.mode !== "word" && item.mode !== "verb") || !item.english) continue;
    if (item.ok === undefined || words.size >= MAX_WORDS_TO_REUSE) continue;
    const english = item.mode === "verb" ? `to ${item.english}` : item.english;
    if (!words.has(english)) words.set(english, item.ok ? "learned" : "missed");
  }
  if (!words.size) return "";
  return (
    "\n\n## Words being learned\nEnglish words the learner recently learned or missed " +
    "in other exercises, the last first. When one fits the theme, the tense and the " +
    "learning point naturally, use it in the translation, never more than one and " +
    "never forced in:\n" +
    [...words].map(([english, result]) => `${english} (${result})`).join(", ")
  );
}

// Spelling, punctuation and "anything else" can't be built into a sentence.
const UNPRACTICED_TAGS: ErrorTag[] = ["spelling", "punctuation", "other"];

// The kinds of mistakes the learner made most in their recent sentences.
// Recent answers only, so a point they have fixed drops out by itself.
// Not from words: a missed word already comes back, and its usual tag (meaning)
// can't be built into a sentence.
function weakPointsSection(input: GenerateInput) {
  const counts = new Map<ErrorTag, number>();
  for (const item of input.history ?? []) {
    if (item.mode !== "sentence" || item.ok !== false) continue;
    // Every mistake of the answer when they are stored, each kind once.
    const tags = new Set(
      item.mistakes?.length ? item.mistakes.map((mistake) => mistake.tag) : [item.tag],
    );
    for (const tag of ERROR_TAGS) {
      if (tags.has(tag) && !UNPRACTICED_TAGS.includes(tag)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
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

// The learner's grammar points: a mastered one is never the learning point
// again, and one to practice again comes back when it fits.
function pointsSection(input: GenerateInput) {
  const { mastered = [], practice = [] } = input.points ?? {};
  return (
    (mastered.length
      ? "\n\n## Points mastered\nThe learner got these right twice: never make one of " +
        "them the learning point again. If every common point of the kind asked for is " +
        "here, use one in another form that isn't (should have, couldn't, don't have " +
        `to):\n${mastered.join(", ")}`
      : "") +
    (practice.length
      ? "\n\n## Points to practice again\nThe learner missed these or got them right " +
        "only once. When one fits the learning point, prefer it, in a new sentence:\n" +
        practice.join(", ")
      : "")
  );
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
      "- point: only the English word or words of the learning point, lowercase, with no",
      "  explanation, parentheses or + (as soon as, should, should have, couldn't, during,",
      "  already, did), or empty if the sentence has no other point than the tense.",
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
      learningPoint(focus, combination.retest) +
      VARIETY +
      PRIORITY,
    // Weak points only matter when the code picked no grammar point.
    // A retest practices only its mistake: no other point is offered.
    sections: combination.retest
      ? wordsSection(input)
      : pointsSection(input) + (focus ? "" : weakPointsSection(input)) + wordsSection(input),
  });
}
