// One French sentence whose translation needs the English tense from the settings.
import { ERROR_TAG_DEFINITIONS, ERROR_TAGS, type ErrorTag } from "@/lib/error-tags";
import {
  checkedItem,
  COMMON_ENGLISH,
  generateBatch,
  history,
  historySection,
  inReference,
  sentenceExerciseSchema,
  type BatchPlan,
  type Exercise,
  type GenerateInput,
  type ItemAnswer,
} from "@/lib/generate/shared";
import { InvalidAnswerError } from "@/lib/model";
import { pointName, TENSE_GUIDES, type SentenceFocus, type Theme } from "@/lib/options";
import { untagged } from "@/lib/correct";
import type { Combination } from "@/lib/settings";

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
    "with its source (« Selon la police… ») or with what is expected next.",
  "cars and EVs":
    "Write it like a line from a first-person car review or a talk between drivers: " +
    "casual, about driving, charging, range, the battery or the price.",
  "movies and TV shows":
    "Write it like a line of dialogue from a movie or a TV show, or what a friend says " +
    "about one: short and natural.",
};

// The one learning point besides the tense: a sentence with several
// difficulties is hard to learn from, and the correction mixes them up. The
// code picks it: a habit, a retest of the last mistake, a grammar point, or
// else the model's choice among the learner's mistakes.
function learningPoint(combination: Combination) {
  const { focus, retest, retestPoint, retestMistake, target } = combination;
  const right = target && untagged(target.right);
  const point = right ?? retestPoint;
  const what = target
    ? `« ${right} », in a situation where a French speaker would write « ` +
      `${untagged(target.wrong)} » as the learner did ${target.count} times`
    : retestPoint
      ? `« ${retestPoint} » again, which the learner just got wrong`
      : retestMistake
        ? `the difficulty of the learner's last mistake again (the same word, structure ` +
          `or word order): « ${untagged(retestMistake).trim()} ». If that mistake was the ` +
          "tense, the tense is the point and point is empty"
        : retest
          ? "the difficulty of the learner's last wrong sentence in the history again"
          : focus
            ? FOCUS_GUIDES[focus]
            : "one difficulty for French speakers: the mistake of a wrong (recent) item " +
              "of the history, else a weak point below, else a common word French " +
              "speakers get wrong";
  return (
    " Learning point: besides the tense, its natural translation needs " +
    `${what}, in a new situation, without pointing it out` +
    (point ? `; the reference uses « ${point} »` : "") +
    "."
  );
}

// The words and verbs met in the other modes, so sentences use them again in
// a new context: words seen in several contexts are remembered better.
const MAX_WORDS_TO_REUSE = 15;

function wordsSection(input: GenerateInput) {
  const words = new Map<string, string>();
  for (const item of [...(input.history ?? [])].reverse()) {
    if ((item.mode !== "word" && item.mode !== "verb") || !item.english) continue;
    if (item.ok === undefined || words.size >= MAX_WORDS_TO_REUSE) continue;
    const learned = (item.ok && item.accepted) || item.english;
    const english = item.mode === "verb" ? `to ${learned}` : learned;
    if (!words.has(english)) words.set(english, item.ok ? "learned" : "missed");
  }
  if (!words.size) return "";
  return (
    "\n\n## Words being learned\nEnglish words the learner met in other exercises, the " +
    "last first. Use one in the translation only if it fits naturally:\n" +
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
    ? "\n\n## Weak points\nThe kinds of mistakes the learner made most in their recent " +
        "sentences:\n" +
        top.map(([tag, count]) => `- ${ERROR_TAG_DEFINITIONS[tag]}: ${count} times`).join("\n")
    : "";
}

// The learner's grammar points: the code asks again for a mastered one, so
// the list only spares that second call; one to practice comes back when it fits.
function pointsSection(input: GenerateInput) {
  const { mastered = [], practice = [] } = input.points ?? {};
  return (
    (mastered.length
      ? "\n\n## Points mastered\nNever the learning point (another form is: should have, " +
        `couldn't):\n${mastered.join(", ")}`
      : "") +
    (practice.length
      ? "\n\n## Points to practice again\nPrefer one when it fits the learning point:\n" +
        practice.join(", ")
      : "")
  );
}

// Planning the verb first keeps the tense right. "As people speak it today"
// gave slang and negations without « ne »; "correct French" alone gave
// literary French.
const FIELDS = [
  "- situation: one short line in English: who, where and when, then the main verb of",
  "  the translation in the tense of its task.",
  "- text: the sentence in correct, modern French with a neutral register (no slang or",
  "  literary tense, always the « ne » of a negation), French punctuation and",
  "  apostrophes, no quotation marks. Check the spelling and accents of every word.",
  "- reference: the most natural American English translation of text, in the tense",
  "  of its task: if that isn't natural, change the French, not the tense. American",
  "  words and spelling, every word where a native speaker puts it, and in the present",
  "  the simple present unless the action is going on right now.",
  "- point: the English word or words of the learning point as the reference has",
  "  them, lowercase (as soon as, should have, did), or empty.",
  "- pointInReference: the words of reference that carry the point, copied exactly",
  "  as written there (had to for have to), or empty.",
];

function task(combination: Combination) {
  const { tense, theme } = combination;
  const guide = tense && TENSE_GUIDES[tense];
  return (
    `one original French sentence on the theme "${theme}", as long as a line in a ` +
    `conversation, a video or the news. Its natural American English translation is in ` +
    `the ${tense}: ${guide?.english}; to get it, use ${guide?.french}.` +
    (theme && THEME_STYLES[theme] ? ` ${THEME_STYLES[theme]}` : "") +
    learningPoint(combination)
  );
}

// Checks one sentence against its own combination.
function checked(
  raw: ItemAnswer,
  combination: Combination,
  mastered: Set<string>,
  final: boolean,
): Exercise {
  const answer = checkedItem(raw, "sentence");
  // A habit or a retest of a point keeps it under its own name, whatever the
  // model calls it: its right answers then make it mastered.
  const forced = combination.target?.right ?? combination.retestPoint;
  const point = forced ? pointName(forced) : answer.point;
  // The point must be in the reference, or the sentence doesn't practice it:
  // asked once more, then the sentence is kept without its point.
  const missing = Boolean(point && !inReference(point, answer.pointInReference ?? "", answer.reference));
  // A mastered point is never the target again, except in a retest or a
  // habit, which practice a mistake whatever was mastered; asked once more.
  const mastery = point && mastered.has(point) && !combination.retest && !combination.target;
  if (!final && missing) {
    throw new InvalidAnswerError(
      `the reference « ${answer.reference} » doesn't use the point « ${point} »; write one that does`,
    );
  }
  if (!final && mastery) {
    throw new InvalidAnswerError(`« ${point} » is mastered; choose another learning point`);
  }
  return {
    ...combination,
    text: answer.text,
    reference: answer.reference,
    ...(point && !missing && { point }),
  };
}

export async function generateSentences(input: GenerateInput, combinations: Combination[]) {
  const { batch, finish } = sentenceBatch(input, combinations);
  return finish(await generateBatch(input, batch));
}

// The call for a batch of sentences, without sending it.
export function sentenceBatch(
  input: GenerateInput,
  combinations: Combination[],
): BatchPlan<ItemAnswer> {
  const mastered = new Set((input.points?.mastered ?? []).map(pointName));
  const { recent } = history(input, "sentence");
  // Weak points only matter for a sentence whose point the model picks;
  // mastered and practice points for one that isn't a retest or a habit.
  const free = combinations.filter((combination) => !combination.retest && !combination.target);
  const batch = {
    mode: "sentence" as const,
    fields: FIELDS,
    schema: sentenceExerciseSchema,
    slots: combinations.map((combination) => ({
      task: task(combination),
      check: (raw: ItemAnswer, final: boolean) => checked(raw, combination, mastered, final),
    })),
    sections:
      (free.length ? pointsSection(input) : "") +
      (free.some((combination) => !combination.focus) ? weakPointsSection(input) : "") +
      "\n\n## Every sentence\nOne learning point besides the tense, never a second, and " +
      "never the plain auxiliary the tense needs (will, would, have, be); combine the " +
      "point with the tense in its natural form (will have to, hasn't been able to). " +
      "Invent concrete, realistic situations, not the most obvious ones " +
      "for the theme, each with another person, structure and sentence type than the " +
      "others and the last sentences of the history. Every word of the translations is " +
      `${COMMON_ENGLISH} The reference stays natural American ` +
      "English: choose a situation where the point is natural rather than bending it." +
      historySection(recent, "sentence") +
      wordsSection(input),
    tokensPerItem: 2000,
  };
  return {
    batch,
    finish: (results) => {
      const kept = results.filter((item): item is Exercise => Boolean(item));
      // A retest left out is tried again in the next batch.
      return combinations[0].retest && !results[0]
        ? [{ ...kept[0], retestMissed: true }, ...kept.slice(1)]
        : kept;
    },
  };
}
